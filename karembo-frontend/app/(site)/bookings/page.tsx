import type { Metadata } from "next";
import { Suspense } from "react";

import { MyBookings } from "@/components/my-bookings";
import { Container, Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Your upcoming and past appointments at Karembo.",
};

export default function BookingsPage() {
  return (
    <Container className="py-16">
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <MyBookings />
      </Suspense>
    </Container>
  );
}
