import type { Metadata } from "next";

import { AdminTeam } from "@/components/admin/admin-team";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Team & rota",
};

export default function AdminTeamPage() {
  return (
    <Container className="py-10">
      <AdminTeam />
    </Container>
  );
}
