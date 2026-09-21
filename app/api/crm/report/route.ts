import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createReportPdf } from "@/lib/report-pdf";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";

export const dynamic = "force-dynamic";

const ADMIN_API = "https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  if (!(await isValidCrmSession(store.get(crmSessionCookie.name)?.value))) {
    return NextResponse.json({ error: "Session expired. Enter the CRM password again." }, { status: 401 });
  }
  const caseId = url.searchParams.get("caseId") || "";
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  const token = process.env.INTEGRITAS_CRM_BACKEND_TOKEN;
  if (!token || !/^[0-9a-f-]{36}$/i.test(caseId)) return NextResponse.json({ error: "Report is unavailable." }, { status: 400 });
  try {
    const response = await fetch(ADMIN_API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integritas-crm-token": token },
      body: JSON.stringify({ action: "snapshot", caseId }),
      cache: "no-store",
    });
    const snapshot = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "Report is unavailable." }, { status: response.status });
    const report = Array.isArray(snapshot.reports) ? snapshot.reports[0] : null;
    const caseTitle = String(snapshot.case?.title || "Integritas investigation");
    if (!report?.content_markdown || report.status !== "finalized") {
      return NextResponse.json({ error: "The report must be reviewed and finalized before PDF download." }, { status: 409 });
    }
    const pdf = createReportPdf(caseTitle, String(report.summary || ""), String(report.content_markdown), new Date().toISOString());
    const filename = `Integritas - ${caseTitle.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report"}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="${filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "The report service could not complete this request." }, { status: 502 });
  }
}
