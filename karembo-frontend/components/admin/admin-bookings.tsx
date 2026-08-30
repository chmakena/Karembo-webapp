"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDateTime, formatPrice, initials } from "@/lib/format";
import type { Booking, BookingStatus } from "@/lib/types";
import { Inbox, Loader2, Search } from "../icons";
import {
  Alert,
  Avatar,
  Card,
  EmptyState,
  Input,
  PageHeading,
  Select,
  Skeleton,
  StatusBadge,
} from "../ui";

const STATUSES: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

/** Statuses an admin can move a booking to from the table. */
const TRANSITIONS: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

export function AdminBookings() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [staffId, setStaffId] = useState("");
  const [from, setFrom] = useState("");

  const { data: staff } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff(),
  });

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["admin", "bookings", { search, status, staffId, from }],
    queryFn: () =>
      api.admin.bookings({
        search: search.trim() || undefined,
        status: status || undefined,
        staff_id: staffId || undefined,
        from: from || undefined,
      }),
  });

  const bookings = data ?? [];

  return (
    <>
      <PageHeading eyebrow="Operations" title="Bookings" />

      <Card className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sand-500" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or reference…"
            aria-label="Search bookings"
            className="pl-11"
          />
        </div>
        <Select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as BookingStatus | "")
          }
          aria-label="Filter by status"
          className="w-auto min-w-40"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={staffId}
          onChange={(event) => setStaffId(event.target.value)}
          aria-label="Filter by stylist"
          className="w-auto min-w-40"
        >
          <option value="">All stylists</option>
          {(staff ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="From date"
          className="w-auto"
        />
      </Card>

      <p className="mt-6 flex items-center gap-2 text-sm text-sand-600">
        {isPending ? (
          "Loading…"
        ) : (
          <>
            <strong>{bookings.length}</strong>
            {bookings.length === 1 ? " booking" : " bookings"}
            {bookings.length === 500 && " (showing the most recent 500)"}
            {isFetching && <Loader2 className="size-3 animate-spin" />}
          </>
        )}
      </p>

      <div className="mt-4">
        {error ? (
          <Alert tone="danger">Could not load bookings. {error.message}</Alert>
        ) : isPending ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : bookings.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Inbox className="size-7" />}
              title="No bookings match"
              description="Try clearing a filter or widening the date range."
            />
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sand-100 text-left">
                  {[
                    "Reference",
                    "Client",
                    "Service",
                    "When",
                    "Status",
                    "Value",
                    "",
                  ].map((heading, index) => (
                    <th
                      key={heading || index}
                      className="whitespace-nowrap px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient();

  const setStatus = useMutation({
    mutationFn: (status: BookingStatus) =>
      api.admin.setBookingStatus(booking.id, { status }),
    onSuccess: (updated) => {
      toast.success(`${updated.reference} marked ${updated.status}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-days"] });
    },
    onError: (error) => {
      // Re-activating a cancelled booking can collide with whatever took its
      // slot, which the API reports as a 409.
      toast.error(error.message);
    },
  });

  return (
    <tr className="border-t border-sand-200 hover:bg-plum-50">
      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">
        {booking.reference}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initials(booking.customer_name)} size="sm" />
          <div className="min-w-0">
            <div className="font-medium">{booking.customer_name}</div>
            <div className="truncate text-xs text-sand-500">
              {booking.customer_email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div>{booking.service_name}</div>
        <div className="text-xs text-sand-600">{booking.staff_name}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-4 numeric">
        {formatDateTime(booking.starts_at)}
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={booking.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right numeric">
        {formatPrice(booking.price_cents)}
      </td>
      <td className="px-4 py-4 text-right">
        <Select
          value={booking.status}
          disabled={setStatus.isPending}
          onChange={(event) =>
            setStatus.mutate(event.target.value as BookingStatus)
          }
          aria-label={`Change status of ${booking.reference}`}
          className="min-h-9 w-auto min-w-32 py-1 text-xs"
        >
          {TRANSITIONS.map((option) => (
            <option key={option} value={option}>
              {option.replace("_", " ")}
            </option>
          ))}
        </Select>
      </td>
    </tr>
  );
}
