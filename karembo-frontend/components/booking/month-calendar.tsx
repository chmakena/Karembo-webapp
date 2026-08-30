"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { api } from "@/lib/api";
import { addDays, dateKey, salonToday } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "../icons";
import { Skeleton } from "../ui";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Days in a month, and which weekday column the 1st falls in (0 = Monday). */
function monthShape(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay is 0 = Sunday; shift so Monday is 0 to match the header.
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  return { daysInMonth, firstWeekday };
}

/**
 * A month grid showing which days have availability.
 *
 * Fetching per-day counts up front means a customer scanning a month can see
 * where the free days are without opening each one. Days with no slots are
 * disabled, so a dead end is never clickable.
 */
export function MonthCalendar({
  staffId,
  serviceId,
  selected,
  onSelect,
  initialMonth,
}: {
  staffId: string;
  serviceId: string;
  selected: string | null;
  onSelect: (date: string) => void;
  /**
   * Month to open on, as `YYYY-MM-DD`. Callers pass the first date that actually
   * has availability — otherwise a customer arriving on a Sunday evening opens
   * the calendar on a month whose only remaining days are closed, with nothing
   * telling them to page forward.
   */
  initialMonth?: string | null;
}) {
  const today = salonToday();
  const [todayYear, todayMonth] = today.split("-").map(Number);

  const [view, setView] = useState(() => {
    if (initialMonth) {
      const [year, month] = initialMonth.split("-").map(Number);
      return { year, month };
    }
    return { year: todayYear, month: todayMonth };
  });

  const { daysInMonth, firstWeekday } = monthShape(view.year, view.month);
  const from = dateKey(view.year, view.month, 1);
  const to = dateKey(view.year, view.month, daysInMonth);

  const { data, isPending } = useQuery({
    queryKey: ["availability-days", staffId, serviceId, from, to],
    queryFn: () =>
      api.catalogue.availabilityDays({ staffId, serviceId, from, to }),
  });

  const slotsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of data ?? []) map.set(day.date, day.slot_count);
    return map;
  }, [data]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.year, view.month - 1, 1)));

  // Don't let the customer page back before the current month, or beyond the
  // booking horizon the API enforces (60 days ≈ 3 months of pages).
  const monthsAhead = (view.year - todayYear) * 12 + (view.month - todayMonth);
  const atStart = monthsAhead <= 0;
  const atEnd = monthsAhead >= 3;

  function shift(delta: number) {
    setView((current) => {
      const index = current.year * 12 + (current.month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  return (
    <div className="rounded-lg border border-sand-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atStart}
          aria-label="Previous month"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full text-sand-600 transition-colors hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <strong className="text-sm">{monthLabel}</strong>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atEnd}
          aria-label="Next month"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full text-sand-600 transition-colors hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-2xs font-semibold uppercase tracking-[0.08em] text-sand-500"
          >
            {label}
          </div>
        ))}
      </div>

      {isPending ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, index) => (
            <div key={`pad-${index}`} aria-hidden />
          ))}

          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const key = dateKey(view.year, view.month, day);
            const count = slotsByDate.get(key) ?? 0;
            const isPast = key < today;
            const isToday = key === today;
            const isSelected = key === selected;
            const disabled = isPast || count === 0;

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(key)}
                aria-label={
                  disabled
                    ? `${day} ${monthLabel}, unavailable`
                    : `${day} ${monthLabel}, ${count} ${count === 1 ? "slot" : "slots"}`
                }
                aria-pressed={isSelected}
                className={clsx(
                  "flex aspect-square min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border text-sm transition-colors numeric",
                  isSelected
                    ? "border-plum-600 bg-plum-600 font-semibold text-white"
                    : disabled
                      ? "cursor-not-allowed border-transparent text-sand-300"
                      : clsx(
                          "border-transparent text-sand-800 hover:border-plum-300 hover:bg-plum-50",
                          isToday && "border-plum-400 font-semibold",
                        ),
                )}
              >
                <span>{day}</span>
                {/* A dot marks days with availability, so a full month is
                    scannable at a glance. */}
                {count > 0 && (
                  <span
                    aria-hidden
                    className={clsx(
                      "size-1 rounded-full",
                      isSelected ? "bg-plum-100" : "bg-plum-400",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-sand-600">
          <span aria-hidden className="size-1.5 rounded-full bg-plum-400" />
          Has availability
        </span>
        <span className="text-sand-500">Sun &amp; Mon closed</span>
      </div>
    </div>
  );
}

/**
 * The soonest date this stylist can do this service, or null if nothing is free
 * inside the search window.
 *
 * Drives both the calendar's opening month and the "earliest available"
 * shortcut, so the customer never has to hunt for the first free day.
 */
export function useNextAvailableDay(staffId: string, serviceId: string) {
  const today = salonToday();

  const { data, isPending } = useQuery({
    queryKey: ["availability-next", staffId, serviceId, today],
    queryFn: () =>
      api.catalogue.availabilityDays({
        staffId,
        serviceId,
        from: today,
        // 62 days is the API's per-request cap and covers its 60-day horizon.
        to: addDays(today, 62),
      }),
  });

  return {
    isPending,
    nextDay: (data ?? []).find((day) => day.slot_count > 0) ?? null,
  };
}
