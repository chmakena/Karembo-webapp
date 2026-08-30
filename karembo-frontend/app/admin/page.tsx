import type { Metadata } from "next";

import { AdminOverview } from "@/components/admin/admin-overview";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Studio overview",
};

export default function AdminOverviewPage() {
  return (
    <Container className="py-10">
      <AdminOverview />
    </Container>
  );
}
