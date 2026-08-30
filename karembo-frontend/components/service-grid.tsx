"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDuration, formatPrice } from "@/lib/format";
import { ArrowRight, Clock, Inbox } from "./icons";
import { Alert, Badge, Card, EmptyState, Skeleton } from "./ui";

/**
 * The service catalogue as cards. Used on the home page (limited) and the full
 * services page (with a category filter).
 */
export function ServiceGrid({
  category,
  limit,
  search,
}: {
  category?: string;
  limit?: number;
  search?: string;
}) {
  const { data, isPending, error } = useQuery({
    queryKey: ["services", category ?? null],
    queryFn: () => api.catalogue.services(category),
  });

  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit ?? 6 }).map((_, index) => (
          <Card key={index} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-2 h-7 w-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert tone="danger">
        Could not load the service menu. {error.message}
      </Alert>
    );
  }

  const needle = search?.trim().toLowerCase();
  let services = data ?? [];

  if (needle) {
    services = services.filter(
      (service) =>
        service.name.toLowerCase().includes(needle) ||
        service.description.toLowerCase().includes(needle) ||
        service.category.toLowerCase().includes(needle),
    );
  }

  if (limit) services = services.slice(0, limit);

  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-7" />}
        title="Nothing matches that"
        description={
          needle
            ? `No service matches “${search}”. Try a different word, or clear the filter.`
            : "There are no services in this category yet."
        }
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Link
          key={service.id}
          href={`/book?service=${service.id}`}
          className="group flex flex-col gap-3 rounded-lg border border-sand-200 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-plum-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <Badge tone="brand">{service.category}</Badge>
            <span className="flex items-center gap-1 text-sm text-sand-600">
              <Clock className="size-3.5" />
              {formatDuration(service.duration_min)}
            </span>
          </div>
          <h3 className="text-xl">{service.name}</h3>
          <p className="flex-1 text-sm leading-relaxed text-sand-600">
            {service.description}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-xl font-semibold text-plum-700 numeric">
              {formatPrice(service.price_cents)}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-plum-600">
              Book
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
