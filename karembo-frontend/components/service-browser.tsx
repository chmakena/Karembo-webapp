"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { api } from "@/lib/api";
import { Search } from "./icons";
import { Card, Input } from "./ui";
import { ServiceGrid } from "./service-grid";

/** Category filter plus search over the catalogue. */
export function ServiceBrowser() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.catalogue.categories(),
  });

  const total = (categories ?? []).reduce(
    (sum, entry) => sum + entry.service_count,
    0,
  );

  return (
    <>
      <Card className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sand-500" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services…"
            aria-label="Search services"
            className="pl-11"
          />
        </div>
      </Card>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by category"
      >
        <CategoryChip
          label="All"
          count={total}
          active={category === undefined}
          onClick={() => setCategory(undefined)}
        />
        {(categories ?? []).map((entry) => (
          <CategoryChip
            key={entry.name}
            label={entry.name}
            count={entry.service_count}
            active={category === entry.name}
            onClick={() => setCategory(entry.name)}
          />
        ))}
      </div>

      <div className="mt-8">
        <ServiceGrid category={category} search={search} />
      </div>
    </>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex min-h-9.5 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-plum-600 bg-plum-600 text-white"
          : "border-sand-300 bg-white text-sand-700 hover:border-plum-300 hover:text-plum-700",
      )}
    >
      {label}
      <span className="text-2xs opacity-75 numeric">{count}</span>
    </button>
  );
}
