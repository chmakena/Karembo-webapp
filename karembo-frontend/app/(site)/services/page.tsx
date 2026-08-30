import type { Metadata } from "next";

import { Container } from "@/components/ui";
import { ServiceBrowser } from "@/components/service-browser";

export const metadata: Metadata = {
  title: "Services",
  description:
    "The full Karembo service menu — hair, braids, nails, beauty and bridal, with real durations and prices.",
};

export default function ServicesPage() {
  return (
    <Container className="py-16">
      <p className="eyebrow">Service menu</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">Everything we do</h1>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-sand-600">
        Real durations and real prices. What you see is what the stylist blocks
        out for you.
      </p>
      <div className="mt-8">
        <ServiceBrowser />
      </div>
    </Container>
  );
}
