"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { AlertCircle } from "../icons";
import { ButtonLink, Container, EmptyState, Skeleton } from "../ui";

/**
 * Keeps non-admins out of the admin UI.
 *
 * This is presentation only. The API rejects every /api/admin call without an
 * admin token, so this component's job is to avoid showing a dashboard full of
 * 403 errors — not to be the thing that stops access.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/signin?next=${encodeURIComponent("/admin")}`);
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <Container className="py-10">
        <Skeleton className="h-12 w-64" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80 rounded-lg" />
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container className="py-10">
        <div className="rounded-lg border border-sand-200 bg-white">
          <EmptyState
            icon={<AlertCircle className="size-7" />}
            title="Staff access only"
            description="This area is for salon staff. Your account doesn't have administrator access."
            action={<ButtonLink href="/bookings">Go to my bookings</ButtonLink>}
          />
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}
