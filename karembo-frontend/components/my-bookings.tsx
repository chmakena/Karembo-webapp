"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import clsx from "clsx";

import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatRelativeDay,
  formatTimeRange,
  initials,
} from "@/lib/format";
import type { Booking } from "@/lib/types";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  Plus,
  X,
} from "./icons";
import {
  Alert,
  Avatar,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeading,
  Skeleton,
  StatusBadge,
} from "./ui";

type Tab = "upcoming" | "past";

export function MyBookings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  // A fresh booking arrives as ?new=<reference> from the booking flow.
  const newReference = searchParams.get("new");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/signin?next=${encodeURIComponent("/bookings")}`);
    }
  }, [authLoading, user, router]);

  const upcoming = useQuery({
    queryKey: ["bookings", "upcoming"],
    queryFn: () => api.bookings.list("upcoming"),
    enabled: Boolean(user),
  });

  const past = useQuery({
    queryKey: ["bookings", "past"],
    queryFn: () => api.bookings.list("past"),
    enabled: Boolean(user),
  });

  if (authLoading || !user) {
    return <Skeleton className="h-96 rounded-lg" />;
  }

  const active = tab === "upcoming" ? upcoming : past;
  const bookings = active.data?.bookings ?? [];

  return (
    <>
      <PageHeading
        eyebrow="Your account"
        title="My bookings"
        actions={
          <ButtonLink href="/book">
            <Plus className="size-4" />
            New booking
          </ButtonLink>
        }
      />

      {newReference && (
        <Alert
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          className="mt-8"
        >
          <p className="font-medium">You&rsquo;re booked in.</p>
          <p className="mt-1">
            Your reference is{" "}
            <strong className="font-mono tracking-wide">{newReference}</strong>.
            You can move or cancel it here up to 12 hours before.
          </p>
        </Alert>
      )}

      <div
        className="mt-8 flex gap-2 border-b border-sand-200"
        role="tablist"
        aria-label="Booking history"
      >
        {(["upcoming", "past"] as const).map((option) => {
          const count =
            option === "upcoming"
              ? upcoming.data?.bookings.length
              : past.data?.bookings.length;
          return (
            <button
              key={option}
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={clsx(
                "flex cursor-pointer items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors",
                tab === option
                  ? "border-plum-600 text-plum-700"
                  : "border-transparent text-sand-600 hover:text-sand-900",
              )}
            >
              {option === "upcoming" ? "Upcoming" : "Past"}
              {count !== undefined && (
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-2xs font-semibold numeric",
                    tab === option
                      ? "bg-plum-100 text-plum-700"
                      : "bg-sand-100 text-sand-600",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {active.isPending ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : active.error ? (
          <Alert tone="danger">
            Could not load your bookings. {active.error.message}
          </Alert>
        ) : bookings.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Inbox className="size-7" />}
              title={
                tab === "upcoming"
                  ? "No appointments booked"
                  : "No past visits yet"
              }
              description={
                tab === "upcoming"
                  ? "When you book, your appointment will appear here with everything you need to find us."
                  : "Once you've been in, your visit history will show up here."
              }
              action={
                tab === "upcoming" ? (
                  <ButtonLink href="/book">Browse services</ButtonLink>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                highlighted={booking.reference === newReference}
                showActions={tab === "upcoming"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function BookingCard({
  booking,
  highlighted,
  showActions,
}: {
  booking: Booking;
  highlighted: boolean;
  showActions: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const cancel = useMutation({
    mutationFn: () => api.bookings.cancel(booking.id),
    onSuccess: () => {
      toast.success("Appointment cancelled.");
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-days"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not cancel the appointment.",
      );
      setConfirming(false);
    },
  });

  const isLive = booking.status === "confirmed" || booking.status === "pending";

  return (
    <Card
      className={clsx(
        highlighted && "border-success-200 ring-2 ring-success-200",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar initials={initials(booking.staff_name)} />
          <div className="min-w-0">
            <h3 className="text-xl">{booking.service_name}</h3>
            <p className="mt-1 text-sm text-sand-600">
              with {booking.staff_name}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-sand-700">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0" />
                {formatDateTime(booking.starts_at)}
              </span>
              <span className="flex items-center gap-1.5 numeric">
                <Clock className="size-3.5 shrink-0" />
                {formatTimeRange(booking.starts_at, booking.ends_at)} (
                {formatDuration(booking.service_duration_min)})
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                Nyali Road
              </span>
            </div>
            {isLive && (
              <p className="mt-2 text-sm font-medium text-plum-700">
                {formatRelativeDay(booking.starts_at)}
              </p>
            )}
            {booking.notes && (
              <p className="mt-3 rounded-md bg-sand-100 p-3 text-sm text-sand-700">
                <span className="font-medium">Your note: </span>
                {booking.notes}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <StatusBadge status={booking.status} />
          <p className="mt-3 font-display text-xl font-semibold text-plum-700 numeric">
            {formatPrice(booking.price_cents)}
          </p>
          <p className="mt-1 font-mono text-xs text-sand-500">
            {booking.reference}
          </p>
        </div>
      </div>

      {showActions && isLive && (
        <div className="mt-4 border-t border-sand-100 pt-4">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium">
                Cancel this appointment?
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {cancel.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Yes, cancel it
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={cancel.isPending}
              >
                Keep it
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href={`/book?service=${booking.service_id}`}
                variant="secondary"
                size="sm"
              >
                <Calendar className="size-3.5" />
                Book another
              </ButtonLink>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {booking.status === "completed" && (
        <div className="mt-4 border-t border-sand-100 pt-4">
          <Link
            href={`/book?service=${booking.service_id}`}
            className="text-sm font-semibold text-plum-600 hover:underline"
          >
            Book this again →
          </Link>
        </div>
      )}

      {booking.status === "cancelled" && booking.cancellation_reason && (
        <p className="mt-4 border-t border-sand-100 pt-4 text-sm text-sand-600">
          <span className="font-medium">Reason: </span>
          {booking.cancellation_reason}
        </p>
      )}
    </Card>
  );
}
