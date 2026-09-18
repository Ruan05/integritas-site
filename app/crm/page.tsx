import type { Metadata } from "next";
import IntegritasAdminWorkspace from "@/components/IntegritasAdminWorkspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Command Center | Integritas",
  description: "Private Integritas due-diligence and AI investigation workspace.",
  robots: { index: false, follow: false },
};

export default function CrmDashboardPage() {
  return <IntegritasAdminWorkspace />;
}
