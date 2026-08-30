"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import clsx from "clsx";

import { api } from "@/lib/api";
import {
  formatDate,
  formatDuration,
  initials,
  trimSeconds,
  weekdayName,
} from "@/lib/format";
import type { StaffMember } from "@/lib/types";
import { AlertCircle, Loader2, Plus, Trash2 } from "../icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeading,
  Skeleton,
} from "../ui";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export function AdminTeam() {
  // Only an explicit click is stored. The effective selection falls back to the
  // first stylist, so the pane is never empty — derived rather than synced into
  // state by an effect.
  const [chosenId, setChosenId] = useState<string | null>(null);

  const { data: staff, isPending } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff(),
  });

  const selected =
    (staff ?? []).find((member) => member.id === chosenId) ?? staff?.[0];
  const selectedId = selected?.id ?? null;

  return (
    <>
      <PageHeading eyebrow="Team" title="Stylists & rota" />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          {isPending
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))
            : (staff ?? []).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setChosenId(member.id)}
                  aria-pressed={member.id === selectedId}
                  className={clsx(
                    "w-full cursor-pointer rounded-lg border p-4 text-left transition-all",
                    member.id === selectedId
                      ? "border-plum-600 bg-plum-50 ring-2 ring-plum-200"
                      : "border-sand-200 bg-white hover:border-plum-300 hover:shadow-sm",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <Avatar initials={initials(member.display_name)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {member.display_name}
                        </span>
                        {member.is_active ? (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Off
                          </Badge>
                        )}
                      </div>
                      <span className="eyebrow mt-1 block">{member.title}</span>
                    </div>
                  </div>
                </button>
              ))}

          <AddStaffForm />
        </div>

        <div>
          {selected ? (
            <StaffDetail member={selected} />
          ) : (
            <Skeleton className="h-96 rounded-lg" />
          )}
        </div>
      </div>
    </>
  );
}

function AddStaffForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ display_name: "", title: "Stylist" });

  const create = useMutation({
    mutationFn: () =>
      api.admin.createStaff({
        display_name: values.display_name.trim(),
        title: values.title.trim() || "Stylist",
      }),
    onSuccess: (member) => {
      toast.success(`${member.display_name} added.`);
      setValues({ display_name: "", title: "Stylist" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (!open) {
    return (
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add stylist
      </Button>
    );
  }

  return (
    <Card>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (values.display_name.trim().length < 2) {
            toast.error("Enter the stylist's name.");
            return;
          }
          create.mutate();
        }}
      >
        <Field label="Name" htmlFor="staff-name" required>
          <Input
            id="staff-name"
            value={values.display_name}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                display_name: event.target.value,
              }))
            }
            placeholder="e.g. Faith Mutiso"
          />
        </Field>
        <Field label="Title" htmlFor="staff-title">
          <Input
            id="staff-title"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function StaffDetail({ member }: { member: StaffMember }) {
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["admin", "services"],
    queryFn: () => api.admin.services(),
  });

  // The public listing carries each stylist's service ids.
  const { data: publicStaff } = useQuery({
    queryKey: ["staff", null],
    queryFn: () => api.catalogue.staff(),
  });

  const { data: hours, isPending: hoursPending } = useQuery({
    queryKey: ["admin", "working-hours", member.id],
    queryFn: () => api.admin.workingHours(member.id),
  });

  const { data: timeOff } = useQuery({
    queryKey: ["admin", "time-off", member.id],
    queryFn: () => api.admin.timeOff(member.id),
  });

  const covered = new Set(
    publicStaff?.find((entry) => entry.id === member.id)?.service_ids ?? [],
  );

  const invalidateAvailability = () => {
    void queryClient.invalidateQueries({ queryKey: ["availability"] });
    void queryClient.invalidateQueries({ queryKey: ["availability-days"] });
  };

  const toggleService = useMutation({
    mutationFn: (serviceId: string) => {
      const next = new Set(covered);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return api.admin.setStaffServices(member.id, [...next]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      invalidateAvailability();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      api.admin.updateStaff(member.id, { is_active: !member.is_active }),
    onSuccess: (updated) => {
      toast.success(
        updated.is_active
          ? `${updated.display_name} is taking bookings.`
          : `${updated.display_name} is off the rota.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      invalidateAvailability();
    },
    onError: (error) => toast.error(error.message),
  });

  const addTimeOff = useMutation({
    mutationFn: (input: { starts_at: string; ends_at: string; reason: string }) =>
      api.admin.createTimeOff(member.id, input),
    onSuccess: (result) => {
      if (result.clashing_bookings > 0) {
        // Warn rather than silently strand customers — the API reports how many
        // live bookings sit inside the new absence.
        toast.warning(
          `Time off saved, but ${result.clashing_bookings} existing booking(s) fall inside it. They are still on the calendar.`,
          { duration: 8000 },
        );
      } else {
        toast.success("Time off saved.");
      }
      void queryClient.invalidateQueries({
        queryKey: ["admin", "time-off", member.id],
      });
      invalidateAvailability();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeTimeOff = useMutation({
    mutationFn: (id: string) => api.admin.deleteTimeOff(id),
    onSuccess: () => {
      toast.success("Time off removed.");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "time-off", member.id],
      });
      invalidateAvailability();
    },
    onError: (error) => toast.error(error.message),
  });

  const shiftsByDay = new Map<number, typeof hours>();
  for (const shift of hours ?? []) {
    const list = shiftsByDay.get(shift.weekday) ?? [];
    list.push(shift);
    shiftsByDay.set(shift.weekday, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar initials={initials(member.display_name)} size="lg" />
            <div>
              <h2 className="text-2xl">{member.display_name}</h2>
              <p className="eyebrow mt-1">{member.title}</p>
            </div>
          </div>
          <Button
            variant={member.is_active ? "danger" : "secondary"}
            size="sm"
            disabled={toggleActive.isPending}
            onClick={() => toggleActive.mutate()}
          >
            {toggleActive.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {member.is_active ? "Take off rota" : "Put back on rota"}
          </Button>
        </div>
        {member.bio && (
          <p className="mt-4 max-w-2xl text-sand-600">{member.bio}</p>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-xl">Weekly rota</h3>
        <Alert
          tone="warning"
          icon={<AlertCircle className="size-4" />}
          className="mb-4"
        >
          Removing a shift does <strong>not</strong> cancel appointments already
          inside it. Existing bookings stay on the calendar so you can move them
          deliberately.
        </Alert>
        {hoursPending ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sand-100 text-left">
                  <th className="px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                    Day
                  </th>
                  <th className="px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                    Shifts
                  </th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((weekday) => {
                  const shifts = shiftsByDay.get(weekday) ?? [];
                  return (
                    <tr key={weekday} className="border-t border-sand-200">
                      <td className="px-4 py-4 font-medium">
                        {weekdayName(weekday)}
                      </td>
                      <td className="px-4 py-4">
                        {shifts.length === 0 ? (
                          <Badge tone="neutral">Closed</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {shifts.map((shift) => (
                              <Badge key={shift.id} tone="brand">
                                <span className="numeric">
                                  {trimSeconds(shift.start_time)}–
                                  {trimSeconds(shift.end_time)}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl">Services offered</h3>
          <Badge tone="brand">
            {covered.size} of {services?.length ?? 0} selected
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(services ?? [])
            .filter((service) => service.is_active)
            .map((service) => {
              const on = covered.has(service.id);
              return (
                <label
                  key={service.id}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                    on
                      ? "border-plum-300 bg-plum-50"
                      : "border-sand-200 bg-white hover:border-plum-300",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={toggleService.isPending}
                    onChange={() => toggleService.mutate(service.id)}
                    className="size-4.5 accent-plum-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{service.name}</span>
                    <span className="text-sm text-sand-600">
                      {" "}
                      · {formatDuration(service.duration_min)}
                    </span>
                  </span>
                </label>
              );
            })}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-xl">Time off</h3>
        <TimeOffForm
          onSubmit={(input) => addTimeOff.mutate(input)}
          isPending={addTimeOff.isPending}
        />

        <div className="mt-4 space-y-3">
          {(timeOff ?? []).length === 0 ? (
            <p className="text-sm text-sand-600">No time off booked.</p>
          ) : (
            (timeOff ?? []).map((entry) => (
              <Card key={entry.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{entry.reason || "Time off"}</p>
                  <p className="text-sm text-sand-600 numeric">
                    {formatDate(entry.starts_at)} – {formatDate(entry.ends_at)}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={removeTimeOff.isPending}
                  onClick={() => removeTimeOff.mutate(entry.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TimeOffForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (input: { starts_at: string; ends_at: string; reason: string }) => void;
  isPending: boolean;
}) {
  const [values, setValues] = useState({ from: "", to: "", reason: "" });

  return (
    <Card>
      <form
        className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!values.from || !values.to) {
            toast.error("Choose a start and end date.");
            return;
          }
          if (values.to < values.from) {
            toast.error("The end date must not be before the start date.");
            return;
          }
          // Cover whole days in salon time: 00:00 on the first day through
          // 00:00 the day after the last, so the final day is fully blocked.
          const endExclusive = new Date(`${values.to}T00:00:00+03:00`);
          endExclusive.setDate(endExclusive.getDate() + 1);
          onSubmit({
            starts_at: new Date(`${values.from}T00:00:00+03:00`).toISOString(),
            ends_at: endExclusive.toISOString(),
            reason: values.reason.trim(),
          });
          setValues({ from: "", to: "", reason: "" });
        }}
      >
        <Field label="From" htmlFor="to-from">
          <Input
            id="to-from"
            type="date"
            value={values.from}
            onChange={(event) =>
              setValues((current) => ({ ...current, from: event.target.value }))
            }
          />
        </Field>
        <Field label="To" htmlFor="to-to">
          <Input
            id="to-to"
            type="date"
            value={values.to}
            onChange={(event) =>
              setValues((current) => ({ ...current, to: event.target.value }))
            }
          />
        </Field>
        <Field label="Reason" htmlFor="to-reason">
          <Input
            id="to-reason"
            value={values.reason}
            onChange={(event) =>
              setValues((current) => ({ ...current, reason: event.target.value }))
            }
            placeholder="Annual leave"
          />
        </Field>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Add
        </Button>
      </form>
    </Card>
  );
}
