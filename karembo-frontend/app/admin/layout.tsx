import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * The admin area.
 *
 * `AdminGate` is a convenience, not the security boundary — it stops a non-admin
 * seeing a broken dashboard. Authorisation is enforced server-side by the
 * `AdminUser` extractor on every /api/admin route, so a hand-crafted request
 * gets a 403 regardless of what the browser renders.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <AdminNav />
      <div className="flex-1 bg-sand-50">
        <AdminGate>{children}</AdminGate>
      </div>
    </>
  );
}
