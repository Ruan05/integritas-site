import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";
import { reportNeedsHold } from "@/lib/report-disposition";
import { reportEligibleForFinalization, verifyReportModel } from "@/lib/integritas-report-model";
import { verifyOracleArtifactBytes } from "@/lib/oracle-report-artifact";

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

async function getOracleReportPdf(caseJobId: string, token: string, expectedRevision: number) {
  const artifactResponse = await fetch(ADMIN_API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-integritas-crm-token": token },
    body: JSON.stringify({ action: "get_report_pdf", caseJobId }),
    cache: "no-store",
  });
  const artifact = await artifactResponse.json().catch(() => ({}));
  if (!artifactResponse.ok || typeof artifact.url !== "string") {
    throw Object.assign(new Error("Oracle's canonical report PDF is not available."), {
      status: artifactResponse.status === 404 ? 409 : 502,
    });
  }
  if (Number(artifact.caseRevision) !== expectedRevision) {
    throw Object.assign(new Error("Oracle's report PDF belongs to a different case revision."), { status: 409 });
  }

  const pdfResponse = await fetch(artifact.url, { cache: "no-store" });
  if (!pdfResponse.ok || !(pdfResponse.headers.get("content-type") || "").toLowerCase().includes("application/pdf")) {
    throw Object.assign(new Error("Oracle's report PDF could not be retrieved."), { status: 502 });
  }
  const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (!await verifyOracleArtifactBytes(bytes, artifact.sha256, Number(artifact.sizeBytes))) {
    throw Object.assign(new Error("Oracle's report PDF failed its integrity check."), { status: 502 });
  }
  return bytes;
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
    const currentRevision = Number(snapshot.case?.revision);
    if (!report?.content_markdown || report.status !== "finalized") {
      return NextResponse.json({ error: "The report must be reviewed and finalized before PDF download." }, { status: 409 });
    }
    if (!Number.isSafeInteger(currentRevision) || Number(report.based_on_revision) !== currentRevision) {
      return NextResponse.json({ error: "This report belongs to an earlier case revision. Run the current investigation before PDF release." }, { status: 409 });
    }
    if (reportNeedsHold(String(report.summary || ""), String(report.content_markdown))) {
      return NextResponse.json({ error: "This investigation has an incomplete or hold disposition. Its PDF cannot be presented as a finalized report." }, { status: 409 });
    }
    const model = await verifyReportModel(report);
    if (!reportEligibleForFinalization(model)) {
      return NextResponse.json({ error: "The canonical report snapshot or its evidence and critic gates could not be verified. Re-run the investigation before PDF release." }, { status: 409 });
    }
    const job = Array.isArray(snapshot.jobs) ? snapshot.jobs.find((row: { id?: string; stage?: string; case_revision?: number }) => row.id === report.case_job_id) : null;
    if (job?.stage !== "completed" || Number(job.case_revision) !== currentRevision) {
      return NextResponse.json({ error: "The source investigation has not completed." }, { status: 409 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(String(report.case_job_id || ""))
      || Number(job.case_revision) !== Number(report.based_on_revision)) {
      return NextResponse.json({ error: "The report is not bound to the completed Oracle investigation revision." }, { status: 409 });
    }
    if (!meetsComprehensiveReportGate(String(report.content_markdown), snapshot)) {
      return NextResponse.json({ error: "The report did not pass the comprehensive evidence and structure gate. Re-run or continue the investigation before downloading the PDF." }, { status: 409 });
    }
    const pdf = await getOracleReportPdf(String(report.case_job_id), token, Number(report.based_on_revision));
    const filename = `Integritas - ${caseTitle.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report"}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="${filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-integritas-source": "oracle-sealed-artifact",
      },
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 502;
    return NextResponse.json({ error: "The verified Oracle report artifact could not be served." }, { status });
  }
}
