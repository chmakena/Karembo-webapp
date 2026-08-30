import type { Metadata } from "next";

import { BookingFlow } from "@/components/booking/booking-flow";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Book an appointment",
  description:
    "Choose a service, a stylist and a time that's genuinely free at Karembo, Mombasa.",
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  // searchParams is a Promise in Next.js 16.
  const params = await searchParams;
  const service = params.service;
  const initialServiceId = Array.isArray(service) ? service[0] : service;

  return (
    <Container className="py-10">
      <BookingFlow initialServiceId={initialServiceId} />
    </Container>
  );
}
