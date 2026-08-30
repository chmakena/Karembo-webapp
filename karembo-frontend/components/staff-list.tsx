"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { Alert, Avatar, Card, Skeleton } from "./ui";

/** The team, as profile cards. */
export function StaffList() {
  const { data, isPending, error } = useQuery({
    queryKey: ["staff", null],
    queryFn: () => api.catalogue.staff(),
  });

  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="text-center">
            <Skeleton className="mx-auto size-26 rounded-full" />
            <Skeleton className="mx-auto mt-4 h-6 w-32" />
            <Skeleton className="mx-auto mt-2 h-3 w-20" />
            <Skeleton className="mx-auto mt-3 h-4 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert tone="danger">Could not load the team. {error.message}</Alert>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {(data ?? []).map((member) => (
        <Card key={member.id} className="text-center">
          <Avatar
            initials={initials(member.display_name)}
            size="xl"
            className="mx-auto"
          />
          <h3 className="mt-4 text-xl">{member.display_name}</h3>
          <p className="eyebrow mt-1">{member.title}</p>
          <p className="mt-3 text-sm leading-relaxed text-sand-600">
            {member.bio}
          </p>
        </Card>
      ))}
    </div>
  );
}
