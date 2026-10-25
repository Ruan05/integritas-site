import { oraclePairReady } from "@/lib/oracle-report-pair";
import { nativeReportReady, reportAudience } from "@/lib/native-report-download";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";
import { reportNeedsHold } from "@/lib/report-disposition";
import { hasVerifiedMaximumDepthStructure, reportEligibleForFinalization, verifyReportModel } from "@/lib/integritas-report-model";
import { verifyOracleArtifactBytes } from "@/lib/oracle-report-artifact";

export const dynamic = "force-dynamic";

const ADMIN_API = "https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api";

type ReportJob = Record<string, unknown> & {
  id: string;
  created_at: string;
  runtime_provider: string;
  case_revision?: number;
  stage?: string;
};

function isReportJob(value: unknown): value is ReportJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.created_at === "string"
    && typeof row.runtime_provider === "string"
    && (row.case_revision === undefined || Number.isSafeInteger(row.case_revision))
    && (row.stage === undefined || typeof row.stage === "string");
}

function meetsComprehensiveReportGate(content: string, snapshot: Record<string, unknown>, model: Awaited<ReturnType<typeof verifyReportModel>>) {
  const text = String(content || "");
  const escapedControls = (text.match(/\\\\[nrt]/g) || []).length;
  return hasVerifiedMaximumDepthStructure(model, text)
    && escapedControls <= 3
    && Array.isArray(snapshot.findings)
    && Array.isArray(snapshot.sources) && snapshot.sources.length > 0;
}

async function getOracleReportPdf(caseJobId: string, token: string, expectedRevision: number, draft: boolean, preliminary = false, audience: "external" | "internal" = "external") {
  const artifactResponse = await fetch(ADMIN_API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-integritas-crm-token": token },
    body: JSON.stringify(preliminary ? { action: "get_preliminary_pdf", caseJobId } : { action: "get_report_pdf", caseJobId, draft, audience }),
    cache: "no-store",
  });
  const rawArtifact = await artifactResponse.json().catch(() => ({}));
  const artifact = rawArtifact && typeof rawArtifact === "object" && !Array.isArray(rawArtifact) ? rawArtifact as { url?: string; sha256?: string; sizeBytes?: number; caseRevision?: number } : {};
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
    const rawSnapshot = await response.json().catch(() => ({}));
      const snapshot = rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot) ? rawSnapshot as { case?: { title?: string; revision?: number }; reports?: Array<{ case_job_id?: string; content_markdown?: string; based_on_revision?: number; status?: string; summary?: string }>; jobs?: Array<{ id?: string; runtime_provider?: string; stage?: string; case_revision?: number; created_at?: string; current_attempt?: number }>; reportPairs?: unknown[] } : {};
    if (!response.ok) return NextResponse.json({ error: "Report is unavailable." }, { status: response.status });
    const report = Array.isArray(snapshot.reports) ? snapshot.reports[0] : null;
    const caseTitle = String(snapshot.case?.title || "Integritas investigation");
    const currentRevision = Number(snapshot.case?.revision);
    const draft = url.searchParams.get("draft") === "1";
    if (url.searchParams.get("stage") === "preliminary") {
      const jobs: ReportJob[] = (Array.isArray(snapshot.jobs) ? snapshot.jobs : []).filter(isReportJob);
      const job = jobs
        .filter((row) => ["openclaw-oracle", "ruan-native"].includes(row.runtime_provider))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!job || Number(job.case_revision) !== currentRevision)
        return NextResponse.json({ error: "Current preliminary report is unavailable." }, { status: 409 });
      const pdf = await getOracleReportPdf(job.id, token, currentRevision, false, true);
      const name = caseTitle.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report";
      return new NextResponse(pdf, { status: 200, headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="Integritas - Preliminary - ${name}.pdf"`,
        "cache-control": "no-store", "x-content-type-options": "nosniff",
        "x-integritas-source": "oracle-preliminary-artifact",
        "x-integritas-report-status": "preliminary-not-clearance",
      } });
    }

    const audience = reportAudience(url.searchParams.get("edition"));
    const jobs: ReportJob[] = (Array.isArray(snapshot.jobs) ? snapshot.jobs : []).filter(isReportJob);
    const nativeJob = jobs.find((row) => row.id === report?.case_job_id && row.runtime_provider === "ruan-native");
    if (nativeJob) {
      if (!nativeReportReady(nativeJob, report as Record<string, unknown>, currentRevision, draft))
        return NextResponse.json({error: "Both current report editions are available after independent review and PDF checks complete."}, {status: 409});
      // The authenticated backend validates the exact edition against the committed
      // native final receipt. Recheck the returned bytes before serving either PDF.
      const pdf = await getOracleReportPdf(nativeJob.id, token, currentRevision, false, false, audience);
      const name = caseTitle.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report";
      const label = audience === "internal" ? "INTERNAL FULL" : "Enhanced Due Diligence";
      return new NextResponse(pdf, {status: 200, headers: {
        "content-type": "application/pdf", "content-disposition": `${disposition}; filename="Integritas - ${label} - ${name}.pdf"`,
        "cache-control": "no-store", "x-content-type-options": "nosniff", "x-integritas-source": "ruan-sealed-artifact",
        "x-integritas-report-status": "finalized", "x-integritas-report-edition": audience,
      }});
    }
    if (audience === "internal" && draft) return NextResponse.json({error: "The internal full edition requires a committed final report pair."}, {status: 409});

    if (!report?.content_markdown) return NextResponse.json({ error: "Report content is unavailable." }, { status: 409 });
    if (!Number.isSafeInteger(currentRevision) || Number(report.based_on_revision) !== currentRevision) {
      return NextResponse.json({ error: "This report belongs to an earlier case revision. Run the current investigation before PDF release." }, { status: 409 });
    }
    const model = await verifyReportModel(report);
    const job = jobs.find((row) => row.id === report.case_job_id) ?? null;
    if (!job || !['completed', 'incomplete'].includes(String(job.stage)) || Number(job.case_revision) !== currentRevision) {
      return NextResponse.json({ error: "The source investigation report is not available for this case revision." }, { status: 409 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(String(report.case_job_id || ""))
      || Number(job.case_revision) !== Number(report.based_on_revision)) {
      return NextResponse.json({ error: "The report is not bound to the completed Oracle investigation revision." }, { status: 409 });
    }
    if (!meetsComprehensiveReportGate(String(report.content_markdown), snapshot, model)) {
      return NextResponse.json({ error: "The report did not pass the comprehensive evidence and structure gate. Re-run or continue the investigation before downloading the PDF." }, { status: 409 });
    }
    if (draft) {
      if (!["draft", "reviewed"].includes(String(report.status))) {
        return NextResponse.json({ error: "Only a current draft or reviewed report can be opened as an internal draft PDF." }, { status: 409 });
      }
    } else {
      if (!oraclePairReady(job, report, snapshot.reportPairs as import("@/lib/oracle-report-pair").OracleReportPair[], currentRevision)) {
        return NextResponse.json({ error: "The final report is released automatically after independent review and artifact checks pass. Those checks are still pending." }, { status: 409 });
      }
      if (reportNeedsHold(String(report.summary || ""), String(report.content_markdown))) {
        return NextResponse.json({ error: "The automated report pipeline did not complete. Its PDF cannot be released as final." }, { status: 409 });
      }
      if (!reportEligibleForFinalization(model)) {
        return NextResponse.json({ error: "The canonical report snapshot or its evidence and critic gates could not be verified. Re-run the investigation before PDF release." }, { status: 409 });
      }
      if (job?.stage !== "completed") {
        return NextResponse.json({ error: "The source investigation has not completed." }, { status: 409 });
      }
    }
    const pdf = await getOracleReportPdf(String(report.case_job_id), token, Number(report.based_on_revision), draft, false, audience);
    const filename = `Integritas - ${audience === "internal" ? "INTERNAL FULL - " : ""}${caseTitle.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report"}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${disposition}; filename="${filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-integritas-source": "oracle-sealed-artifact",
        "x-integritas-report-edition": audience,
        "x-integritas-report-status": draft ? "draft-review-required" : "finalized",
      },
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 502;
    return NextResponse.json({ error: "The verified Oracle report artifact could not be served." }, { status });
  }
}
