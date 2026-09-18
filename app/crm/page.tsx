import type { Metadata } from "next";
import { cookies } from "next/headers";
import IntegritasAdminWorkspace from "@/components/IntegritasAdminWorkspace";
import CrmPasswordGate from "@/components/CrmPasswordGate";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Command Center",
  description: "Private Integritas due-diligence and AI investigation workspace.",
  robots: { index: false, follow: false },
};

export default async function CrmDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(crmSessionCookie.name)?.value;
  const preauthorized = await isValidCrmSession(session);

  if (!preauthorized) return <CrmPasswordGate />;
  return <IntegritasAdminWorkspace />;
}
