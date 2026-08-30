import type { Metadata } from "next";

import { AccountSettings } from "@/components/account-settings";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your Karembo profile and password.",
};

export default function AccountPage() {
  return (
    <Container narrow className="py-16">
      <AccountSettings />
    </Container>
  );
}
