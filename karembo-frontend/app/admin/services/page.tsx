import type { Metadata } from "next";

import { AdminServices } from "@/components/admin/admin-services";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
};

export default function AdminServicesPage() {
  return (
    <Container className="py-10">
      <AdminServices />
    </Container>
  );
}
