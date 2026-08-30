"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import clsx from "clsx";

import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTime,
  initials,
} from "@/lib/format";
import type { Service, StaffMember } from "@/lib/types";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Sparkles,
} from "../icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Skeleton,
  Textarea,
} from "../ui";
import { MonthCalendar, useNextAvailableDay } from "./month-calendar";
import { Stepper } from "./stepper";

interface Draft {
  service: Service | null;
  staff: StaffMember | null;
  date: string | null;
  slotStart: string | null;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  service: null,
  staff: null,
  date: null,
  slotStart: null,
  notes: "",
};

/**
 * Waits for the service list before mounting the wizard.
 *
 * Splitting this out lets `Flow` seed its state from `?service=<id>` in a
 * `useState` initialiser instead of an effect. Deriving state in an effect would
 * mean an extra render pass and a flash of step 1 before jumping to step 2.
 */
export function BookingFlow({ initialServiceId }: { initialServiceId?: string }) {
  const { data: services, isPending } = useQuery({
    queryKey: ["services", null],
    queryFn: () => api.catalogue.services(),
  });

  if (isPending) {
    return (
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <Flow services={services ?? []} initialServiceId={initialServiceId} />
  );
}

function Flow({
  services,
  initialServiceId,
}: {
  services: Service[];
  initialServiceId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();

  // Arriving from a service card pre-selects that service and opens on step 2,
  // rather than making the customer choose the same thing twice.
  const preselected = initialServiceId
    ? (services.find((service) => service.id === initialServiceId) ?? null)
    : null;

  const [step, setStep] = useState(preselected ? 2 : 1);
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY_DRAFT,
    service: preselected,
  });

  function selectService(service: Service) {
    setDraft((current) =>
      // Changing the service invalidates the stylist and slot beneath it.
      current.service?.id === service.id
        ? { ...current, service }
        : { ...EMPTY_DRAFT, notes: current.notes, service },
    );
    setStep(2);
  }

  function selectStaff(staff: StaffMember) {
    setDraft((current) =>
      current.staff?.id === staff.id
        ? { ...current, staff }
        : { ...current, staff, date: null, slotStart: null },
    );
    setStep(3);
  }

  const createBooking = useMutation({
    mutationFn: () => {
      if (!draft.service || !draft.staff || !draft.slotStart) {
        throw new Error("Incomplete booking");
      }
      return api.bookings.create({
        service_id: draft.service.id,
        staff_id: draft.staff.id,
        starts_at: draft.slotStart,
        notes: draft.notes.trim() || undefined,
      });
    },
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-days"] });
      router.push(`/bookings?new=${booking.reference}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isConflict) {
        // Someone took the slot first. Drop it and send them back to pick
        // again, with the calendar already refreshed.
        setDraft((current) => ({ ...current, slotStart: null }));
        setStep(3);
        void queryClient.invalidateQueries({ queryKey: ["availability"] });
        void queryClient.invalidateQueries({ queryKey: ["availability-days"] });
      }
      toast.error(error.message);
    },
  });

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <Stepper
          current={step}
          onStepClick={(target) => setStep(target)}
        />

        <div className="mt-8">
          {step === 1 && (
            <ServiceStep
              services={services}
              selectedId={draft.service?.id ?? null}
              onSelect={selectService}
            />
          )}

          {step === 2 && draft.service && (
            <StaffStep
              service={draft.service}
              selectedId={draft.staff?.id ?? null}
              onSelect={selectStaff}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && draft.service && draft.staff && (
            <DateTimeStep
              service={draft.service}
              staff={draft.staff}
              date={draft.date}
              slotStart={draft.slotStart}
              onSelectDate={(date) =>
                setDraft((current) => ({ ...current, date, slotStart: null }))
              }
              onSelectSlot={(slotStart) =>
                setDraft((current) => ({ ...current, slotStart }))
              }
              onBack={() => setStep(2)}
              onContinue={() => setStep(4)}
            />
          )}

          {step === 4 && draft.service && draft.staff && draft.slotStart && (
            <ConfirmStep
              draft={draft}
              user={user}
              authLoading={authLoading}
              onSignIn={() =>
                router.push(
                  `/signin?next=${encodeURIComponent(
                    `/book?service=${draft.service?.id ?? ""}`,
                  )}`,
                )
              }
              onNotesChange={(notes) =>
                setDraft((current) => ({ ...current, notes }))
              }
              onBack={() => setStep(3)}
              onConfirm={() => createBooking.mutate()}
              isSubmitting={createBooking.isPending}
            />
          )}
        </div>
      </div>

      <SummaryRail
        draft={draft}
        step={step}
        onContinue={() => setStep(step + 1)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 1 — service
// --------------------------------------------------------------------------

function ServiceStep({
  services,
  selectedId,
  onSelect,
}: {
  services: Service[];
  selectedId: string | null;
  onSelect: (service: Service) => void;
}) {
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Service[]>();
    for (const service of services) {
      const list = byCategory.get(service.category) ?? [];
      list.push(service);
      byCategory.set(service.category, list);
    }
    return [...byCategory.entries()];
  }, [services]);

  return (
    <div>
      <h1 className="text-3xl">What are you booking?</h1>
      <p className="mt-2 text-sand-600">
        Durations are what your stylist actually blocks out.
      </p>

      <div className="mt-6 space-y-8">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <p className="eyebrow mb-3">{category}</p>
            <div className="space-y-2">
              {items.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onSelect(service)}
                  aria-pressed={selectedId === service.id}
                  className={clsx(
                    "flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 text-left transition-all",
                    selectedId === service.id
                      ? "border-plum-600 bg-plum-50 ring-2 ring-plum-200"
                      : "border-sand-200 bg-white hover:border-plum-300 hover:shadow-sm",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{service.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-sand-600">
                      {service.description}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="flex items-center gap-1 text-sm text-sand-600">
                      <Clock className="size-3.5" />
                      {formatDuration(service.duration_min)}
                    </span>
                    <span className="font-display font-semibold text-plum-700 numeric">
                      {formatPrice(service.price_cents)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 2 — stylist
// --------------------------------------------------------------------------

function StaffStep({
  service,
  selectedId,
  onSelect,
  onBack,
}: {
  service: Service;
  selectedId: string | null;
  onSelect: (staff: StaffMember) => void;
  onBack: () => void;
}) {
  // Asking the API to filter guarantees every stylist shown can actually
  // perform this service.
  const { data, isPending } = useQuery({
    queryKey: ["staff", service.id],
    queryFn: () => api.catalogue.staff(service.id),
  });

  return (
    <div>
      <h1 className="text-3xl">Who would you like?</h1>
      <p className="mt-2 text-sand-600">
        Everyone here does <strong>{service.name}</strong>.
      </p>

      {isPending ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<AlertCircle className="size-7" />}
            title="No stylist available"
            description="Nobody is currently set up for this service. Please pick another, or call the salon."
            action={
              <Button variant="secondary" onClick={onBack}>
                Choose another service
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-2">
          {(data ?? []).map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member)}
              aria-pressed={selectedId === member.id}
              className={clsx(
                "flex w-full cursor-pointer items-start gap-4 rounded-lg border p-4 text-left transition-all",
                selectedId === member.id
                  ? "border-plum-600 bg-plum-50 ring-2 ring-plum-200"
                  : "border-sand-200 bg-white hover:border-plum-300 hover:shadow-sm",
              )}
            >
              <Avatar initials={initials(member.display_name)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{member.display_name}</span>
                <span className="eyebrow mt-0.5 block">{member.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-sand-600">
                  {member.bio}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <Button variant="ghost" onClick={onBack} className="mt-6">
        <ArrowLeft className="size-4" />
        Back to services
      </Button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 3 — date and time
// --------------------------------------------------------------------------

function DateTimeStep({
  service,
  staff,
  date,
  slotStart,
  onSelectDate,
  onSelectSlot,
  onBack,
  onContinue,
}: {
  service: Service;
  staff: StaffMember;
  date: string | null;
  slotStart: string | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slotStart: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  // Resolve the earliest bookable day before mounting the calendar, so it opens
  // on a month that has something in it.
  const { nextDay, isPending: nextDayPending } = useNextAvailableDay(
    staff.id,
    service.id,
  );

  const { data, isPending, isFetching } = useQuery({
    queryKey: ["availability", staff.id, service.id, date],
    queryFn: () =>
      api.catalogue.availability({
        staffId: staff.id,
        serviceId: service.id,
        date: date!,
      }),
    enabled: date !== null,
  });

  // Memoised so the grouping below has a stable dependency; `data?.slots ?? []`
  // would allocate a fresh array on every render.
  const slots = useMemo(() => data?.slots ?? [], [data]);

  // A break in the rota shows up as a gap in the slot list. Splitting on it
  // gives the customer the morning/afternoon grouping they expect.
  const { morning, afternoon } = useMemo(() => {
    const before: typeof slots = [];
    const after: typeof slots = [];
    for (const slot of slots) {
      const hour = Number(formatTime(slot.starts_at).slice(0, 2));
      (hour < 13 ? before : after).push(slot);
    }
    return { morning: before, afternoon: after };
  }, [slots]);

  return (
    <div>
      <h1 className="text-3xl">Pick a date and time</h1>
      <p className="mt-2 text-sand-600">
        Times shown are free in <strong>{staff.display_name}&rsquo;s</strong>{" "}
        diary for a <strong>{service.name}</strong> (
        {formatDuration(service.duration_min)}).
      </p>

      {!nextDayPending && !nextDay && (
        <Alert
          tone="warning"
          icon={<AlertCircle className="size-4" />}
          className="mt-6"
        >
          {staff.display_name} has nothing free in the next two months. Try
          another stylist, or call the salon on +254&nbsp;700&nbsp;000&nbsp;000.
        </Alert>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {nextDayPending ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <MonthCalendar
            staffId={staff.id}
            serviceId={service.id}
            selected={date}
            onSelect={onSelectDate}
            initialMonth={nextDay?.date ?? null}
          />
        )}

        <div>
          {!date ? (
            <Card>
              <EmptyState
                icon={<Sparkles className="size-7" />}
                title="Choose a day"
                description="Days with a dot have appointments free. Pick one to see the times."
                action={
                  nextDay ? (
                    <Button onClick={() => onSelectDate(nextDay.date)}>
                      Earliest: {formatDateLong(`${nextDay.date}T12:00:00Z`)}
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : isPending ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="h-11 rounded-md" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Clock className="size-7" />}
                title="Fully booked"
                description="There are no times left on this day. Try another date from the calendar."
              />
            </Card>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl">{formatDateLong(`${date}T12:00:00Z`)}</h2>
                <Badge tone={slots.length <= 3 ? "warning" : "neutral"}>
                  {slots.length} {slots.length === 1 ? "slot" : "slots"} left
                </Badge>
              </div>

              {slots.length <= 3 && (
                <Alert
                  tone="warning"
                  icon={<AlertCircle className="size-4" />}
                  className="mb-5"
                >
                  This is a busy day. Slots are only held once you confirm.
                </Alert>
              )}

              {morning.length > 0 && (
                <SlotGroup
                  label="Morning"
                  slots={morning}
                  selected={slotStart}
                  onSelect={onSelectSlot}
                />
              )}

              {afternoon.length > 0 && (
                <div className={morning.length > 0 ? "mt-6" : undefined}>
                  <SlotGroup
                    label="Afternoon"
                    slots={afternoon}
                    selected={slotStart}
                    onSelect={onSelectSlot}
                  />
                </div>
              )}

              <p className="mt-5 text-xs text-sand-600">
                All times are East Africa Time (UTC+3).
                {isFetching && " Refreshing…"}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Change stylist
        </Button>
        <Button onClick={onContinue} disabled={!slotStart}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SlotGroup({
  label,
  slots,
  selected,
  onSelect,
}: {
  label: string;
  slots: { starts_at: string; ends_at: string }[];
  selected: string | null;
  onSelect: (slotStart: string) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-3">{label}</p>
      <div
        role="radiogroup"
        aria-label={`${label} times`}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {slots.map((slot) => {
          const isSelected = selected === slot.starts_at;
          return (
            <button
              key={slot.starts_at}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(slot.starts_at)}
              className={clsx(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors numeric",
                isSelected
                  ? "border-plum-600 bg-plum-600 font-semibold text-white"
                  : "border-sand-300 bg-white text-sand-800 hover:border-plum-600 hover:bg-plum-50 hover:text-plum-700",
              )}
            >
              {formatTime(slot.starts_at)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 4 — confirm
// --------------------------------------------------------------------------

function ConfirmStep({
  draft,
  user,
  authLoading,
  onSignIn,
  onNotesChange,
  onBack,
  onConfirm,
  isSubmitting,
}: {
  draft: Draft;
  user: ReturnType<typeof useAuth>["user"];
  authLoading: boolean;
  onSignIn: () => void;
  onNotesChange: (notes: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div>
      <h1 className="text-3xl">Check and confirm</h1>
      <p className="mt-2 text-sand-600">
        Nothing is held until you confirm.
      </p>

      {authLoading ? (
        <Skeleton className="mt-6 h-32 rounded-lg" />
      ) : !user ? (
        // Signing in navigates away, so the chosen slot is lost — but ?service=
        // brings them back to the right service, and availability may well have
        // changed by then anyway.
        <Alert
          tone="info"
          icon={<AlertCircle className="size-4" />}
          className="mt-6"
        >
          <p className="font-medium">You need an account to finish booking.</p>
          <p className="mt-1">
            It takes about twenty seconds, and lets you move or cancel the
            appointment yourself later.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onSignIn}>
              Sign in or register
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <Card className="mt-6">
            <p className="eyebrow">Booking for</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar initials={initials(user.full_name)} />
              <div>
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-sand-600">{user.email}</p>
                {user.phone && (
                  <p className="text-sm text-sand-600 numeric">{user.phone}</p>
                )}
              </div>
            </div>
          </Card>

          <div className="mt-6">
            <Field
              label="Notes for your stylist"
              htmlFor="booking-notes"
              hint="Allergies, hair history, or a reference photo you'll bring. Optional."
            >
              <Textarea
                id="booking-notes"
                value={draft.notes}
                maxLength={1000}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Anything we should know?"
              />
            </Field>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="size-4" />
              Change time
            </Button>
            <Button size="lg" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Confirming…" : "Confirm booking"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Summary rail
// --------------------------------------------------------------------------

function SummaryRail({
  draft,
  step,
  onContinue,
}: {
  draft: Draft;
  step: number;
  onContinue: () => void;
}) {
  const rows: { key: string; value: string }[] = [];

  if (draft.service) {
    rows.push({ key: "Service", value: draft.service.name });
    rows.push({
      key: "Duration",
      value: formatDuration(draft.service.duration_min),
    });
  }
  if (draft.staff) rows.push({ key: "Stylist", value: draft.staff.display_name });
  if (draft.slotStart) {
    rows.push({
      key: "When",
      value: `${formatDateLong(draft.slotStart)}, ${formatTime(draft.slotStart)}`,
    });
  } else if (draft.date) {
    rows.push({ key: "Date", value: formatDateLong(`${draft.date}T12:00:00Z`) });
  }

  const canContinue =
    (step === 1 && draft.service) ||
    (step === 2 && draft.staff) ||
    (step === 3 && draft.slotStart);

  return (
    <aside className="lg:sticky lg:top-24">
      <Card>
        <h2 className="text-xl">Your appointment</h2>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-sand-600">
            Choose a service to get started.
          </p>
        ) : (
          <div className="mt-5">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex justify-between gap-4 border-b border-dashed border-sand-200 py-3 text-sm last:border-0"
              >
                <span className="shrink-0 text-sand-600">{row.key}</span>
                <span className="text-right font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {draft.service && (
          <>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-sand-300 pt-4">
              <span className="text-sand-600">Total</span>
              <span className="font-display text-xl font-semibold text-plum-700 numeric">
                {formatPrice(draft.service.price_cents)}
              </span>
            </div>
            <p className="mt-2 text-xs text-sand-600">
              Payable at the salon. No card needed to book.
            </p>
          </>
        )}

        {step < 4 && canContinue && (
          <Button block size="lg" onClick={onContinue} className="mt-5">
            Continue
            <ArrowRight className="size-4" />
          </Button>
        )}
      </Card>
    </aside>
  );
}
