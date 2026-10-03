import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createReportPdf } from "@/lib/report-pdf";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";
import { reportNeedsHold } from "@/lib/report-disposition";

export const dynamic = "force-dynamic";

const ADMIN_API = "https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api";

function meetsComprehensiveReportGate(content: string, snapshot: Record<string, unknown>) {
  const text = String(content || "");
  const sectionSignals = [
    /master summary|executive decision summary/i,
    /document.{0,24}(forensic|entity)|document, forensic/i,
    /transaction.{0,24}(research|contradiction)|transaction analysis/i,
    /evidence.{0,24}(unresolved|methodology)|closure register|source ledger/i,
    /direct next steps|recommended order|what to do now/i,
  ];
  const escapedControls = (text.match(/\\\\[nrt]/g) || []).length;
  return text.length >= 4000
    && sectionSignals.filter((pattern) => pattern.test(text)).length >= 4
    && escapedControls <= 3
    && Array.isArray(snapshot.documents) && snapshot.documents.length > 0
    && Array.isArray(snapshot.findings) && snapshot.findings.length > 0
    && Array.isArray(snapshot.sources) && snapshot.sources.length > 0;
}

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
    if (reportNeedsHold(String(report.summary || ""), String(report.content_markdown))) {
      return NextResponse.json({ error: "This investigation has an incomplete or hold disposition. Its PDF cannot be presented as a finalized report." }, { status: 409 });
    }
    if (!meetsComprehensiveReportGate(String(report.content_markdown), snapshot)) {
      return NextResponse.json({ error: "The report did not pass the comprehensive evidence and structure gate. Re-run or continue the investigation before downloading the PDF." }, { status: 409 });
    }
    const pdf = await createReportPdf(
      caseTitle,
      String(report.summary || ""),
      String(report.content_markdown),
      new Date().toISOString(),
      {
        documents: Array.isArray(snapshot.documents) ? snapshot.documents : [],
        sources: Array.isArray(snapshot.sources) ? snapshot.sources : [],
        findings: Array.isArray(snapshot.findings) ? snapshot.findings : [],
        checks: Array.isArray(snapshot.checks) ? snapshot.checks : [],
        entities: Array.isArray(snapshot.entities) ? snapshot.entities : [],
        relationships: Array.isArray(snapshot.relationships) ? snapshot.relationships : [],
        reportStatus: String(report.status || ""),
      },
    );
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
