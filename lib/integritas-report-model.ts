export type VerifiedReportModel = {
  schema_version: 1;
  model_version: "integritas-report-model-v1";
  identity: { case_id: string; case_job_id: string; case_revision: number };
  disposition: "eligible_for_analyst_review" | "draft_review_required";
  quality: { execution: string; pre_report_critic: string; final_report_critic: string; narrative_synthesis: string; report_structure: string; document_visual_review: string; analyst_review: string };
  counts: Record<string, number>;
  distributions: Record<string, Record<string, number>>;
  markdown_sha256: string;
};

export type ModelReport = {
  case_id?: string;
  case_job_id?: string;
  based_on_revision?: number;
  content_markdown?: string;
  report_model?: unknown;
  report_model_sha256?: string;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyReportModel(report: ModelReport | null): Promise<VerifiedReportModel | null> {
  if (!report?.report_model || typeof report.report_model !== "object" || Array.isArray(report.report_model)) return null;
  const model = report.report_model as VerifiedReportModel;
  if (model.schema_version !== 1 || model.model_version !== "integritas-report-model-v1"
    || model.identity?.case_id !== report.case_id
    || model.identity?.case_job_id !== report.case_job_id
    || model.identity?.case_revision !== report.based_on_revision
    || !["eligible_for_analyst_review", "draft_review_required"].includes(model.disposition)
    || !model.counts || !model.distributions || !model.quality
    || !/^[0-9a-f]{64}$/.test(report.report_model_sha256 ?? "")
    || !/^[0-9a-f]{64}$/.test(model.markdown_sha256)) return null;
  const keys = ["entities", "relationships", "findings", "contradictions", "sources", "submitted_documents", "submitted_sources", "external_sources", "validated_external_sources", "opened_external_sources", "discovery_external_sources", "checks", "completed_checks", "unresolved_gates"];
  if (keys.some((key) => !Number.isSafeInteger(model.counts[key]) || model.counts[key] < 0)) return null;
  if (await sha256(report.content_markdown ?? "") !== model.markdown_sha256) return null;
  if (await sha256(canonical(model)) !== report.report_model_sha256) return null;
  return model;
}

export function reportEligibleForFinalization(model: VerifiedReportModel | null): boolean {
  return Boolean(model && model.disposition === "eligible_for_analyst_review"
    && model.quality.execution === "completed"
    && model.quality.pre_report_critic === "pass"
    && model.quality.final_report_critic === "pass"
    && model.quality.narrative_synthesis === "model_synthesis"
    && model.quality.document_visual_review === "pass"
    && model.quality.report_structure !== "missing_or_invalid"
    && (model.quality.report_structure === "not_required"
      || model.quality.report_structure === "maximum_depth_edd_28_v1_verified"));
}

export { hasVerifiedMaximumDepthStructure };
import { hasVerifiedMaximumDepthStructure } from "./maximum-report-structure.mjs";
