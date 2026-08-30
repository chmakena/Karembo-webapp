"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import {
  formatPrice,
  formatTime,
  initials,
  salonToday,
} from "@/lib/format";
import { AlertCircle, ArrowRight, Clock, TrendingUp } from "../icons";
import {
  Alert,
  Avatar,
  ButtonLink,
  Card,
  EmptyState,
  Skeleton,
  StatTile,
  StatusBadge,
} from "../ui";

export function AdminOverview() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.admin.overview(),
  });

  const today = salonToday();
  const diary = useQuery({
    queryKey: ["admin", "bookings", "today", today],
    queryFn: () => api.admin.bookings({ from: today, to: today }),
  });

  const greeting = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  if (overview.error) {
    return (
      <Alert tone="danger">
        Could not load the dashboard. {overview.error.message}
      </Alert>
    );
  }

  const data = overview.data;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1 className="mt-2 text-3xl">Studio overview</h1>
        </div>
        <ButtonLink href="/admin/bookings">
          View all bookings
          <ArrowRight className="size-4" />
        </ButtonLink>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {overview.isPending || !data ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))
        ) : (
          <>
            <StatTile
              label="Today"
              value={data.bookings_today}
              meta={
                <>
                  <Clock className="size-3" />
                  {data.bookings_upcoming} upcoming in total
                </>
              }
            />
            <StatTile
              label="This week"
              value={data.bookings_this_week}
              meta={
                <>
                  <TrendingUp className="size-3" />
                  {data.active_staff} stylists working
                </>
              }
              metaTone="success"
            />
            <StatTile
              label="Week revenue"
              value={formatPrice(data.revenue_this_week_cents)}
              currency
              meta={
                <>
                  <TrendingUp className="size-3" />
                  {formatPrice(data.revenue_confirmed_upcoming_cents)} booked ahead
                </>
              }
              metaTone="success"
            />
            <StatTile
              label="Cancellations"
              value={data.cancellations_this_week}
              meta={
                <>
                  <AlertCircle className="size-3" />
                  this week
                </>
              }
              metaTone={
                data.cancellations_this_week > 0 ? "warning" : "muted"
              }
            />
          </>
        )}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="mb-4 text-2xl">Today&rsquo;s diary</h2>
          {diary.isPending ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (diary.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Clock className="size-7" />}
                title="Nothing booked today"
                description="The diary is clear. Bookings made for today will appear here."
              />
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-sand-100 text-left">
                    <th className="px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                      Time
                    </th>
                    <th className="px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                      Client
                    </th>
                    <th className="hidden px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600 sm:table-cell">
                      Stylist
                    </th>
                    <th className="px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(diary.data ?? [])
                    // The API returns newest-first; a diary reads chronologically.
                    .slice()
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                    .map((booking) => (
                      <tr
                        key={booking.id}
                        className="border-t border-sand-200 hover:bg-plum-50"
                      >
                        <td className="px-4 py-4 font-semibold numeric">
                          {formatTime(booking.starts_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              initials={initials(booking.customer_name)}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-medium">
                                {booking.customer_name}
                              </div>
                              <div className="truncate text-sand-600">
                                {booking.service_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-4 text-sand-700 sm:table-cell">
                          {booking.staff_name}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-4 py-4 text-right numeric">
                          {formatPrice(booking.price_cents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-xl">Stylist load</h3>
            <p className="mt-1 mb-5 text-sm text-sand-600">
              Bookings, last 30 days
            </p>
            {overview.isPending || !data ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-4">
                {data.busiest_staff.map((entry) => {
                  const busiest = data.busiest_staff[0]?.booking_count || 1;
                  const percent = Math.round(
                    (entry.booking_count / busiest) * 100,
                  );
                  return (
                    <div key={entry.staff_id}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {entry.staff_name}
                        </span>
                        <span className="text-sm text-sand-600 numeric">
                          {entry.booking_count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                        <div
                          className="h-full rounded-full bg-plum-500"
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-xl">Most booked</h3>
            <p className="mt-1 mb-4 text-sm text-sand-600">Last 30 days</p>
            {overview.isPending || !data ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="space-y-3">
                {data.popular_services.map((entry) => (
                  <li
                    key={entry.service_id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate text-sm">
                      {entry.service_name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold numeric">
                      {entry.booking_count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data && (
            <Card>
              <h3 className="text-xl">Salon</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between gap-3">
                  <span className="text-sand-600">Active services</span>
                  <span className="font-semibold numeric">
                    {data.active_services}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-sand-600">Active stylists</span>
                  <span className="font-semibold numeric">
                    {data.active_staff}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-sand-600">Customers</span>
                  <span className="font-semibold numeric">
                    {data.total_customers}
                  </span>
                </li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
