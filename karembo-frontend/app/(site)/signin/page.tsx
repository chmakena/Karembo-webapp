import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPanel } from "@/components/auth-panel";
import { CheckCircle2 } from "@/components/icons";
import { Container, Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Karembo to manage your salon appointments.",
};

const BENEFITS = [
  "Rebook a past service in two taps",
  "Reschedule or cancel without calling",
  "Keep notes your stylist should know",
];

export default function SignInPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">
            Sign in to Karembo
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-sand-600">
            Your bookings, your stylist, your history — all in one place.
          </p>
          <ul className="mt-8 space-y-4">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" />
                <span className="text-sm">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* AuthPanel reads ?next= via useSearchParams, so it needs a boundary. */}
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <AuthPanel />
        </Suspense>
      </div>
    </Container>
  );
}
