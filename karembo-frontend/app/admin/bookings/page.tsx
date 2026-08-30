import type { Metadata } from "next";

import { AdminBookings } from "@/components/admin/admin-bookings";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Bookings",
};

export default function AdminBookingsPage() {
  return (
    <Container className="py-10">
      <AdminBookings />
    </Container>
  );
}
