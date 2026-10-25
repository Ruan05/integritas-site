"use client";
import {readJsonObject} from '@/lib/json-response';

import {useConfirmation} from "@/components/dashboard/confirm-action";
import PremiumDashboard from "@/components/dashboard/PremiumDashboard";
import { oraclePairReady, type OracleReportPair } from "@/lib/oracle-report-pair";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentIntakePanel } from "@/components/DocumentIntakePanel";
import CaseAgentChat, { caseChatRequest } from "@/components/CaseAgentChat";
import { crmIntakeClient } from "@/lib/crm-intake";
import { buildFullDDSubmissionFiles, buildQuestionOnlyRevisionRequest, hasVerifiedCaseEvidence, type SubmissionInput } from "@/lib/intake-browser";
import InvestigationReport from "@/components/InvestigationReport";
import {startVisiblePolling} from "@/lib/visible-polling.mjs";
import { reportNeedsHold } from "@/lib/report-disposition";
import { reportEligibleForFinalization, verifyReportModel, type VerifiedReportModel } from "@/lib/integritas-report-model";
import {readWithRetry} from "@/lib/crm-read-recovery.mjs";
import {
  CheckCircle2,
  Download,
  FileText,
  Pause,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  SUPPORTED_CASE_FILE_ACCEPT,
  validateCaseDocumentSelection,
} from "@/lib/integritas-browser";
import { hasActiveCaseInvestigation, resolveCaseSubmissionTarget } from "@/lib/intake-routing.mjs";

type CaseRow = {
  id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at?: string;
  status?: string;
  latest_report?: ReportRow | null;
  latest_job?: Pick<JobRow, "id" | "stage" | "progress" | "updated_at"> | null;
};

type JobRow = {
  id: string;
  case_id: string;
  case_revision: number;
  control_command_id?: string | null;
  stage: string;
  progress: number;
  runtime_provider?: string;
  created_at?: string;
  updated_at?: string;
  current_attempt?: number;
  safe_metadata?: Record<string, unknown>;
  checkpoint_metadata?: Record<string, unknown>;
  checkpoint?: CheckpointRow;
  latest_checkpoint?: CheckpointRow;
};

type CheckpointRow = { stage?: string; progress?: number; attempt?: number; safe_metadata?: Record<string, unknown>; created_at?: string; updated_at?: string; case_job_id?: string };

type ReportRow = {
  id: string;
  case_id?: string;
  case_job_id?: string;
  status: string;
  finalization_method?: string;
  summary?: string;
  content_markdown?: string;
  limitations?: string;
  created_at?: string;
  updated_at?: string;
  based_on_revision?: number;
  report_model?: unknown;
  report_model_sha256?: string;
};

type PreliminaryRow = { case_id: string; case_job_id: string; case_revision: number; sha256: string; created_at: string; safe_metadata?: { release_mode?: string; final?: boolean; issued_at?: string } };

type Snapshot = {
  reportPairs?: OracleReportPair[];
  preliminaryReports?: PreliminaryRow[];
  case?: CaseRow & Record<string, unknown>;
  documents?: Array<{ id: string; name: string; created_at: string; sha256?: string }>;
  jobs?: JobRow[];
  reports?: ReportRow[];
  findings?: unknown[];
  sources?: unknown[];
  checks?: unknown[];
  checkpoints?: CheckpointRow[];
};

type QuestionOnlyAttempt = {
  kind: "question_only";
  caseId: string;
  caseRevision: number;
  clientKey: string;
  question: string;
  context: string;
  replaceConfirmed: boolean;
};
type AcceptedAttempt = SubmissionInput | QuestionOnlyAttempt;
function isQuestionOnlyAttempt(attempt: AcceptedAttempt): attempt is QuestionOnlyAttempt {
  return "kind" in attempt && attempt.kind === "question_only";
}

type Milestone = { stage: string; label: string };

const MILESTONES: Milestone[] = [
  { stage: "extraction", label: "Page extraction and OCR" },
  { stage: "routing", label: "Adaptive route selection" },
  { stage: "normalization", label: "Entity, role and transaction normalization" },
  { stage: "research", label: "Specialist research lanes" },
  { stage: "critic", label: "Independent critic and revision" },
  { stage: "assembly", label: "Structured dossier assembly" },
  { stage: "qa", label: "Semantic and deterministic QA" },
  { stage: "commit", label: "Private PDF/artifact commit" },
];

const TERMINAL = new Set(["completed", "incomplete", "failed", "cancelled", "paused", "research_limit_reached"]);

const STAGE_COPY: Record<string, { label: string; note: string }> = {
  queued: { label: "Preparing your investigation", note: "Securing the case and preparing the evidence." },
  extracting: { label: "Reading documents", note: "Extracting useful text and document details." },
  analyzing_documents: { label: "Analysing documents", note: "Reviewing every uploaded document and identifying key claims." },
  mapping_entities: { label: "Mapping people and companies", note: "Separating identities, companies, relationships and identifiers." },
  planning_research: { label: "Planning verification", note: "Prioritising the checks needed to verify material claims." },
  researching: { label: "Researching public sources", note: "Following relevant leads through permitted research tools." },
  verifying: { label: "Verifying claims", note: "Comparing evidence against available reliable sources." },
  cross_checking: { label: "Cross-checking evidence", note: "Looking for contradictions, gaps and unresolved checks." },
  independent_review: { label: "Independent review", note: "A separate review pass is challenging the draft findings." },
  drafting_report: { label: "Writing your report", note: "Building the final structured due-diligence report." },
  completed: { label: "Report ready", note: "The investigation completed and the report is archived." },
  incomplete: { label: "Investigation incomplete", note: "Technical or report checks need recovery before a final report can be released." },
  failed: { label: "Investigation needs attention", note: "The run stopped before a final report could be produced." },
  cancelled: { label: "Investigation cancelled", note: "The run was cancelled." },
  paused: { label: "Investigation paused", note: "The worker stopped at a durable checkpoint. Continue to resume this investigation." },
  research_limit_reached: { label: "Research limit reached", note: "The report records what was completed and what remains open." },
};

async function crmRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/crm/backend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJsonObject(response);
  if (!response.ok) throw Object.assign(new Error(String(payload?.error || "Request failed.")), { status: response.status });
  return payload;
}


function newestJob(snapshot: Snapshot | null) {
  const jobs = (snapshot?.jobs ?? []).filter((job) => ["openclaw-oracle", "ruan-native"].includes(job.runtime_provider ?? ""));
  return jobs.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function newestReport(snapshot: Snapshot | null) {
  return (snapshot?.reports ?? [])[0] ?? null;
}

function caseTitle(files: File[]) {
  const first = files[0]?.name?.replace(/\.[^.]+$/, "").trim() || "New investigation";
  const safe = first.length > 70 ? first.slice(0, 70) + "…" : first;
  return `${safe} · ${new Date().toLocaleDateString("en-ZA")}`;
}

function downloadMarkdown(report: ReportRow, title: string) {
  const content = report.content_markdown || report.summary || "No report content is available.";
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Integritas - ${title.replace(/[^a-z0-9 _-]+/gi, "").slice(0, 80) || "Report"}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function liveCheckpoint(job: JobRow, snapshot: Snapshot | null) {
  const rows = (snapshot?.checkpoints ?? [])
    .filter((row) => !row.case_job_id || row.case_job_id === job.id)
    .filter((row) => !Number.isInteger(job.current_attempt) || row.attempt === job.current_attempt)
    .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")));
  const jobCheckpoint = [job.latest_checkpoint, job.checkpoint]
    .find((row) => row && (!Number.isInteger(job.current_attempt) || row.attempt === job.current_attempt));
  return rows[0] ?? jobCheckpoint;
}

function committedPdfReady(job: JobRow, snapshot: Snapshot | null) {
  const checkpoint = liveCheckpoint(job, snapshot);
  return checkpoint?.safe_metadata?.render_status === "ready"
    && typeof checkpoint.safe_metadata?.pdf_sha256 === "string"
    && checkpoint.safe_metadata.pdf_sha256.length === 64;
}

function currentSubmodule(job: JobRow, snapshot: Snapshot | null) {
  const checkpoint = liveCheckpoint(job, snapshot);
  const metadata = checkpoint?.safe_metadata ?? job.checkpoint_metadata ?? job.safe_metadata ?? {};
  const phase = String(metadata.current_submodule ?? metadata.submodule ?? metadata.phase ?? checkpoint?.stage ?? job.stage);
  const stage = phase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
  const lane = Number(metadata.lane_index ?? metadata.lane_number ?? metadata.current_lane);
  const total = Number(metadata.lane_total ?? metadata.total_lanes);
  const task = metadata.current_task && typeof metadata.current_task === "object" && !Array.isArray(metadata.current_task)
    ? metadata.current_task as Record<string, unknown> : null;
  const detail = [task?.label, task?.detail, metadata.message ?? metadata.detail ?? metadata.phase_detail ?? metadata.current_detail]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" · ");
  const route = [task?.provider, task?.model].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" / ");
  const label = /ocr|extract|document_shards|visual_shard|document_review/.test(stage) ? MILESTONES[0].label
    : /route|plan/.test(stage) ? MILESTONES[1].label
    : /entity|normaliz|mapping|analys|analyz/.test(stage) ? MILESTONES[2].label
    : /research|lane|verif|cross_check/.test(stage) ? MILESTONES[3].label
    : /critic|independent|revision/.test(stage) ? MILESTONES[4].label
    : /dossier|assembl|draft|synthes|sectioned_report|report_(?:group|section)/.test(stage) ? MILESTONES[5].label
    : /qa|quality/.test(stage) ? MILESTONES[6].label
    : /pdf|artifact|commit|publish|complet/.test(stage) ? MILESTONES[7].label
    : phase.replaceAll("_", " ");
  return { label, detail, route, lane: Number.isInteger(lane) && lane > 0 && Number.isInteger(total) && total > 0 ? `Lane ${lane}/${total}` : "" };
}

export function milestoneStatus(index: number, job: JobRow, snapshot: Snapshot | null) {
  // A deterministic no-subject intake intentionally bypasses substantive
  // research, critic and synthesis. A completed artifact must not imply those
  // investigation lanes ran merely because the job reached 100%.
  const noInvestigableEvidence = (snapshot?.reports ?? []).some((report) =>
    /No investigable evidence identified; the case completed through deterministic intake/i.test(report.summary ?? ""),
  );
  if (job.stage === "completed" && noInvestigableEvidence && index >= 2 && index <= 5) return "not applicable";
  if (job.stage === "paused") {
    const prior = (snapshot?.checkpoints ?? [])
      .filter((row) => row.case_job_id === job.id && row.attempt === job.current_attempt && row.stage !== "paused")
      .sort((a, b) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? "")))[0];
    if (!prior) return "waiting";
    const previous = currentSubmodule({ ...job, stage: prior.stage ?? job.stage, latest_checkpoint: prior }, { checkpoints: [prior] });
    const previousIndex = MILESTONES.findIndex((item) => item.label === previous.label);
    return previousIndex >= 0 && index < previousIndex ? "complete" : "waiting";
  }
  const current = currentSubmodule(job, snapshot);
  const active = MILESTONES.findIndex((item) => item.label === current.label);
  if (TERMINAL.has(job.stage)) {
    if (job.stage === "completed" || committedPdfReady(job, snapshot)) return index <= MILESTONES.length - 1 ? "complete" : "waiting";
    return index === active ? "blocked" : "waiting";
  }
  if (active < 0) return "waiting";
  if (index < active) return "complete";
  return index === active ? "active" : "waiting";
}

export default function IntegritasAdminWorkspace() {
  const confirmation=useConfirmation();
  const [question, setQuestion] = useState("");
  const [newCaseMode, setNewCaseMode] = useState(true);
  const [clientName,setClientName]=useState("");
  const [newClientId,setNewClientId]=useState<string|null>(null);
  const createRequest=useRef<{key:string;input:Record<string,unknown>}|null>(null);
  const [attemptFrozen, setAttemptFrozen] = useState(false);
  const acceptedAttempt = useRef<AcceptedAttempt | null>(null);
  const creating = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [activeCaseId, setActiveCaseId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [readError, setReadError] = useState("");
  const [modelVerification, setModelVerification] = useState<{
    report: ReportRow | null;
    model: VerifiedReportModel | null;
    checked: boolean;
  }>({ report: null, model: null, checked: false });
  const [_archiveMenu, setArchiveMenu] = useState<string | null>(null);
  const [pendingCreateRequest, setPendingCreateRequest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearReadNotice = useCallback(() => {
    setReadError("");
  }, []);
  const markReadNotice = useCallback((error: unknown) => {
    setReadError(error instanceof Error ? error.message : String(error));
  }, []);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId) ?? (snapshot?.case as CaseRow | undefined) ?? null,
    [cases, activeCaseId, snapshot],
  );
  const currentSnapshot = snapshot?.case?.id === activeCaseId ? snapshot : null;
  const job = newestJob(currentSnapshot);
  const report = newestReport(currentSnapshot);
  const verificationMatchesReport = modelVerification.report === report;
  const verifiedModel = verificationMatchesReport ? modelVerification.model : null;
  const modelChecked = verificationMatchesReport && modelVerification.checked;
  const preliminary = (currentSnapshot?.preliminaryReports ?? []).find(row =>
    row.case_id === activeCaseId && row.case_job_id === job?.id
    && row.case_revision === currentSnapshot?.case?.revision
    && row.safe_metadata?.release_mode === "preliminary" && row.safe_metadata?.final === false);
  useEffect(() => {
    let live = true;
    const currentReport = report;
    void verifyReportModel(report ?? null).then((model) => {
      if (live) setModelVerification({ report: currentReport, model, checked: true });
    }).catch(() => {
      if (live) setModelVerification({ report: currentReport, model: null, checked: true });
    });
    return () => { live = false; };
  }, [report]);
  const progress = job?.progress ?? 0;
  const submodule = job ? currentSubmodule(job, snapshot) : null;
  const reportMatchesCurrentJob = Boolean(job && report?.case_job_id === job.id
    && Number(report?.based_on_revision) === Number(job.case_revision)
    && Number(report?.based_on_revision) === Number(snapshot?.case?.revision));
  const reportIncomplete = Boolean(reportMatchesCurrentJob && report && reportNeedsHold(report.summary || "", report.content_markdown || ""));
  const modelEligible = reportEligibleForFinalization(verifiedModel);
  const nativeFinalized = job?.runtime_provider === "ruan-native" && job.stage === "completed"
    && report?.finalization_method === "automated_independent_review";
  const oraclePairFinalized = oraclePairReady(job, report, snapshot?.reportPairs, Number(snapshot?.case?.revision));
  const reportFinalized = reportMatchesCurrentJob && report?.status === "finalized"
    && (nativeFinalized || (oraclePairFinalized && !reportIncomplete && modelEligible));
  const reportDraftPdfReady = Boolean(reportMatchesCurrentJob && report
    && ["draft", "reviewed"].includes(report.status)
    && verifiedModel?.quality.report_structure === "maximum_depth_edd_28_v1_verified"
    && job && committedPdfReady(job, snapshot));
  const stage = reportIncomplete
    ? STAGE_COPY.incomplete
    : reportFinalized
      ? STAGE_COPY.completed
      : job && !TERMINAL.has(job.stage)
        ? STAGE_COPY[job.stage] ?? STAGE_COPY.queued
        : reportMatchesCurrentJob && report
          ? {
              label: modelEligible ? "Final report checks in progress" : "Report checks need recovery",
              note: modelEligible
                ? "The report passed evidence and narrative review. Final PDF inspection and automatic release are pending."
                : "Oracle saved a draft, but its evidence, critic or report-integrity gates are not verified. It cannot be marked complete or released as a final PDF.",
            }
          : job?.stage === "completed"
            ? {
                label: "Oracle run ended — report not verified",
                note: "The run has no report snapshot verified for this case revision. The investigation is not ready for release.",
              }
      : STAGE_COPY[job?.stage ?? "queued"] ?? STAGE_COPY.queued;
  const running = Boolean(job && !TERMINAL.has(job.stage));
  const canContinue = Boolean(
    !reportFinalized
      && job?.id
      && ["failed", "incomplete", "cancelled", "paused", "research_limit_reached"].includes(job.stage),
  );
  const canStop = Boolean(running && job?.id);

  const continueInvestigation = async () => {
    if (!job?.id || submitting) return;
    setSubmitting(true);
    setNotice("Continuing the investigation from its last safe checkpoint…");
    try {
      await crmRequest({ action: job.stage === "paused" ? "resume_case_investigation" : "retry_case_investigation", case_job_id: job.id });
      await refreshCases(activeCaseId);
      await loadCase(activeCaseId);
      setNotice("Investigation continued. You can leave this page and return later.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const stopInvestigation = async (intent: "pause" | "cancel") => {
    if (!job?.id || submitting) return;
    const pause = intent === "pause";
    const confirmed = await confirmation.confirm("Stop investigation",
      pause
        ? "Pause this investigation at its next safe checkpoint? Its documents, evidence ledger and recovery checkpoint will be retained so it can be continued later."
        : "Cancel this investigation at its next safe checkpoint? Its documents and audit history will be retained, but no further work will run unless you explicitly continue it later.",
    );
    if (!confirmed) return;
    setSubmitting(true);
    setNotice(pause ? "Pausing safely at the next durable checkpoint…" : "Cancelling safely at the next durable checkpoint…");
    try {
      await crmRequest({ action: pause ? "pause_case_investigation" : "cancel_case_investigation", case_job_id: job.id });
      await refreshCases(activeCaseId);
      await loadCase(activeCaseId);
      setNotice(pause ? "Pause requested. The worker will stop at its next durable checkpoint." : "Cancellation requested. The worker will stop at its next durable checkpoint.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const archiveCase = async (item: CaseRow) => {
    if (!await confirmation.confirm("Archive investigation", "It will disappear from the workspace, while its evidence and audit history remain retained securely.")) return;
    setSubmitting(true);
    setArchiveMenu(null);
    setNotice("Archiving investigation…");
    try {
      await crmRequest({ action: "archive_case", caseId: item.id });
      const nextCases = await refreshCases(activeCaseId === item.id ? undefined : activeCaseId);
      if (activeCaseId === item.id) {
        setActiveCaseId(nextCases[0]?.id || "");
        setSnapshot(null);
      }
      setNotice("Investigation archived. Evidence remains retained securely.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshCases = async (prefer?: string) => {
    const payload = await crmRequest({ action: "list_cases" });
    clearReadNotice();
    const rows = (Array.isArray(payload.cases) ? payload.cases : [])
      .filter((row: CaseRow) => !String(row.title || "").startsWith("[SYNTHETIC]")) as CaseRow[];
    setCases(rows);
    if (prefer) setActiveCaseId(prefer);
    else setActiveCaseId((current) => current || rows[0]?.id || "");
    return rows;
  };

  const setPollingActive = useRef<((active: boolean) => void) | null>(null);
  const loadCase = async (caseId: string) => {
    if (!caseId) {
      setSnapshot(null);
      return null;
    }
    const data = await crmRequest({ action: "snapshot", caseId });
    clearReadNotice();
    setSnapshot(data as Snapshot);
    const job = newestJob(data as Snapshot);
    setPollingActive.current?.(Boolean(job && !TERMINAL.has(job.stage)));
    return data as Snapshot;
  };

  useEffect(() => {
    let cancelled = false;
    void readWithRetry(() => crmRequest({ action: "list_cases" })).then((casePayload) => {
      if (cancelled) return;
      clearReadNotice();
      const rows = (Array.isArray(casePayload.cases) ? casePayload.cases : [])
        .filter((row: CaseRow) => !String(row.title || "").startsWith("[SYNTHETIC]")) as CaseRow[];
      setCases(rows);
      setActiveCaseId(current=>current||rows[0]?.id||"");
    }).catch((error) => {
      if (!cancelled) markReadNotice(error);
    });
    return () => { cancelled = true; };
  }, [clearReadNotice,markReadNotice]);

  useEffect(() => {
    if (!activeCaseId) return;
    let cancelled = false;
    let terminalVersion = "";
    const poll = startVisiblePolling(async () => {
      const data = await crmRequest({ action: "snapshot", caseId: activeCaseId });
      if (cancelled) return false;
      setSnapshot(data as Snapshot);
      clearReadNotice();
      const nextJob = newestJob(data as Snapshot);
      if (nextJob && TERMINAL.has(nextJob.stage)) {
        const version = `${nextJob.id}:${nextJob.stage}:${nextJob.current_attempt}:${nextJob.updated_at}`;
        if (version !== terminalVersion) {
          await refreshCases(activeCaseId);
          terminalVersion = version;
        }
      }
      return Boolean(nextJob && !TERMINAL.has(nextJob.stage));
    }, {idleDelay: 45000, onError: (error: unknown) => {
      if (!cancelled) markReadNotice(error);
    }});
    setPollingActive.current = poll.setActive;
    void poll.refresh();
    const refreshOnFocus = () => { void poll.refresh(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      cancelled = true;
      setPollingActive.current = null;
      poll.stop();
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [activeCaseId,clearReadNotice,markReadNotice,refreshCases]);

  const chooseFiles = (next: File[]) => {
    try {
      if (!next.length) return;
      const existingCount = !newCaseMode && currentSnapshot?.case?.id === activeCaseId
        ? currentSnapshot.documents?.length ?? 0
        : 0;
      validateCaseDocumentSelection(existingCount, next);
      const invalid = next.find((file) => file.size > 50 * 1024 * 1024);
      if (invalid) throw new Error(`${invalid.name} is larger than 50 MB.`);
      setFiles(next);
      setNotice("");
    } catch (error) {
      setFiles([]);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  async function ensureFolder(submissionFiles:File[]):Promise<string> {
    if(!createRequest.current){
      createRequest.current={key:"case:"+crypto.randomUUID(),input:{action: "create_case", authorized: true,clientId:newClientId||undefined, title: clientName.trim()||caseTitle(submissionFiles),clientName:clientName.trim()||caseTitle(submissionFiles),
      purpose: "Maximum-depth, source-grounded due-diligence investigation with independent review and both report editions.",
      authorizedScope: "Review all submitted evidence, digital and document forensics, identity and authority, ownership, sanctions, operations, banking, commercial plausibility and contradictions. Preserve unresolved verification gates.",
      intendedSubjects: "Entities identified in the submitted evidence", jurisdictions: "International; determine from the evidence."}};
      setPendingCreateRequest(true);
    }
    setAttemptFrozen(true);
    const created=await crmRequest({...createRequest.current.input,idempotencyKey:createRequest.current.key});
    const caseId = String(created.caseId || "");
    if (!caseId) throw new Error("The case could not be created.");
    return caseId;
  }

  const submitInvestigation = async () => {
    if (submitting || creating.current) return;
    creating.current = true;
    setSubmitting(true);
    setNotice("Preparing your submission…");
    let beginningSubmission = false;
    try {
      if (Array.from(question).length > 3000)
        throw new Error("Your message is limited to 3,000 characters.");
      if (!acceptedAttempt.current) {
        const latest = !newCaseMode && activeCaseId ? await loadCase(activeCaseId) : null;
        const target = resolveCaseSubmissionTarget({ newCaseMode, activeCaseId, snapshot: latest });
        const hasExistingEvidence = hasVerifiedCaseEvidence(latest?.documents ?? []);
        const questionOnly = Boolean(target && hasExistingEvidence && files.length === 0);
        const submissionFiles = questionOnly ? [] : buildFullDDSubmissionFiles(files, question);
        if (target) {
          if (!questionOnly) validateCaseDocumentSelection(latest?.documents?.length ?? 0, submissionFiles);
          const replacingActiveRun = hasActiveCaseInvestigation(latest);
          if (replacingActiveRun && !await confirmation.confirm("Replace active investigation",
            files.length
              ? "This case still has an active DD run. This submission will create a new case revision using existing verified evidence, your new files, and the conversation history. Continue?"
              : "This case still has an active DD run. This submission will create a new case revision using its existing verified evidence and conversation history. Continue?",
          )) {
            setNotice("No changes were made. The current investigation is still running.");
            return;
          }
          const contextQuestion = question.trim() || "Run full due diligence using the verified evidence already attached to this case.";
          const priorConversation = await caseChatRequest({ action: "chat_context", caseId: target.caseId, question: contextQuestion });
          const common = {
            ...target,
            clientKey: "intake:" + crypto.randomUUID(),
            question,
            context: String(priorConversation.context || "").slice(0, 6000),
            replaceConfirmed: replacingActiveRun,
          };
          acceptedAttempt.current = questionOnly
            ? { ...common, kind: "question_only" }
            : { ...common, files: [...submissionFiles] };
        } else {
          validateCaseDocumentSelection(0, submissionFiles);
          const caseId=await ensureFolder(submissionFiles);
          const prepared = await crmRequest({action: "snapshot", caseId}) as Snapshot;
          const revision = Number(prepared.case?.revision);
          if (!Number.isSafeInteger(revision)) throw new Error("The case revision is unavailable.");
          acceptedAttempt.current = {caseId, caseRevision: revision, clientKey: "intake:" + crypto.randomUUID(),
            question, context: "", files: [...submissionFiles], replaceConfirmed: false};
        }
        setAttemptFrozen(true);
      }
      const attempt = acceptedAttempt.current;
      await refreshCases(attempt.caseId);
      await loadCase(attempt.caseId);
      if (isQuestionOnlyAttempt(attempt)) {
        beginningSubmission = true;
        const result = await crmRequest(buildQuestionOnlyRevisionRequest(attempt));
        beginningSubmission = false;
        if (!Number.isSafeInteger(Number(result.case_revision)))
          throw new Error("The question-only DD revision could not be confirmed. Retry this same submission to recover its status.");
        await loadCase(attempt.caseId);
        try {
          await caseChatRequest({
            action: "chat_send", caseId: attempt.caseId, clientKey: attempt.clientKey + ":chat",
            message: attempt.question.trim() || "Run full due diligence using the verified evidence already attached to this case.",
          });
        } catch { /* The sealed revision is already accepted; the SQL intent remains authoritative. */ }
        acceptedAttempt.current = null; setAttemptFrozen(false); setFiles([]); setQuestion(""); setNewCaseMode(false);
        if (inputRef.current) inputRef.current.value = "";
        setNotice("Your DD revision is accepted. It reuses the case’s verified evidence and prior conversation; progress and reports will appear here.");
        return;
      }
      beginningSubmission = true;
      let submission = await crmIntakeClient.beginSubmission("crm-session", attempt);
      beginningSubmission = false;
      for (const item of submission.items.filter(item => item.state === "pending")) {
        const match = /^file-(\d+)$/.exec(item.key);
        const file = match ? attempt.files[Number(match[1])] : undefined;
        if (!file) throw new Error("Reopen this case and reselect the missing evidence to resume.");
        setNotice(`Verifying ${item.name}…`);
        submission = await crmIntakeClient.uploadSubmissionItem("crm-session", submission.batchId, item.id, file);
      }
      await loadCase(attempt.caseId);
      setNotice(submission.state === "sealed"
        ? "Your DD brief and evidence are sealed. The full investigation has the case history and prior evidence. Progress and reports will appear here."
        : "Upload is incomplete. Resume the required files in this case below.");
      if (submission.state === "sealed") {
        try {
          await caseChatRequest({action:"chat_send",caseId:attempt.caseId,clientKey:attempt.clientKey+":chat",message:attempt.question.trim()||"Please explain what has been received for this case and what the investigation will cover."});
          setNotice("Your DD brief and evidence are accepted. The case is queued for full investigation; progress and reports will appear here.");
        } catch {
          setNotice("Your DD brief and evidence are accepted. The case is queued for full investigation; progress and reports will appear here.");
        }
        acceptedAttempt.current = null; setAttemptFrozen(false); setFiles([]); setQuestion(""); setNewCaseMode(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (beginningSubmission && [400, 409].includes(status)) {
        acceptedAttempt.current = null;
        setAttemptFrozen(false);
      }
      const message = error instanceof Error ? error.message : String(error);
      setNotice(message);
      throw new Error(message);
    } finally { creating.current = false; setSubmitting(false); }
  };

  const resetNew = () => {
    if (submitting) return;
    acceptedAttempt.current = null;
    setAttemptFrozen(false);
    setNewCaseMode(true);
    setQuestion("");
    setFiles([]);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };
  const requestNew = async (clientId?:string) => {
    if(submitting||creating.current)return false;
    if((attemptFrozen||files.length||question.trim()||clientName.trim())&&!await confirmation.confirm("Start another investigation?","Your unsent brief and attached files will be cleared. Evidence already accepted by the service remains saved in its case."))return false;
    createRequest.current=null;setPendingCreateRequest(false);setClientName("");setNewClientId(clientId||null);resetNew();return true;
  };
  const requestCase = async (id:string) => {
    if(submitting||creating.current)return false;
    if(id===activeCaseId&&!newCaseMode)return true;
    if((attemptFrozen||files.length||question.trim()||clientName.trim())&&!await confirmation.confirm("Change client folder?","Your unsent brief and file selection will be cleared before switching folders. Accepted evidence stays with its original case."))return false;
    createRequest.current=null;acceptedAttempt.current=null;setAttemptFrozen(false);setFiles([]);setQuestion("");setArchiveMenu(null);setNewCaseMode(false);setActiveCaseId(id);setPendingCreateRequest(false);
    if(inputRef.current)inputRef.current.value="";
    return true;
  };
  const createFolderOnly=async()=>{
    if(submitting||creating.current||!clientName.trim()&&!pendingCreateRequest)return;
    creating.current=true;setSubmitting(true);setNotice("Creating your client folder…");
    try{const id=await ensureFolder(files);await refreshCases(id);await loadCase(id);setNewCaseMode(false);setClientName("");setNewClientId(null);setAttemptFrozen(false);setNotice("Folder created and saved. Add evidence and run full DD when ready; creating a folder does not start an investigation.");}
    catch(e){setNotice(e instanceof Error?e.message:"The folder could not be confirmed. Retry this same request to recover its status.");}
    finally{creating.current=false;setSubmitting(false);}
  };
  useEffect(()=>{
    if(!files.length&&!question.trim()&&!clientName.trim())return;
    const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
  },[files.length,question,clientName]);

  const canCreateFolder = !(!clientName.trim() && pendingCreateRequest);
  const composer=(<>{newCaseMode?<div className="new-client-name"><label htmlFor="client-folder-name">{newClientId?"Investigation title in the existing client folder":"Client folder name"}</label><input id="client-folder-name" maxLength={160} value={clientName} onChange={e=>setClientName(e.target.value)} disabled={submitting||attemptFrozen} placeholder="Client or company name (optional until evidence establishes identity)"/><button className="dash-button" onClick={()=>void createFolderOnly()} disabled={submitting||!canCreateFolder}>{submitting?"Saving…":attemptFrozen?"Retry folder creation":"Create folder"}</button><p className="dash-muted">Create and save the folder now. Full DD starts only when you submit its evidence and brief.</p></div>:null}
<CaseAgentChat
            key={newCaseMode ? "new-investigation" : activeCaseId || "new-investigation"}
            caseId={newCaseMode ? undefined : activeCase?.id}
            title={newCaseMode ? undefined : activeCase?.title}
            draft={question} onDraftChange={setQuestion}
            fileCount={files.length} uploadBusy={submitting} frozen={attemptFrozen}
            onAttach={() => inputRef.current?.click()} onStart={submitInvestigation} onNew={()=>void requestNew()}
            attachments={(
            <div className="p-4 sm:p-5">
              <input ref={inputRef} type="file" accept={SUPPORTED_CASE_FILE_ACCEPT} multiple className="sr-only" disabled={submitting || attemptFrozen}
                onChange={(event) => chooseFiles(Array.from(event.target.files ?? []))} />
              <button type="button" disabled={submitting || attemptFrozen} onClick={() => inputRef.current?.click()}
                onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();chooseFiles(Array.from(event.dataTransfer.files));}}
                className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/30 bg-[#D4AF37]/[0.025] px-4 py-5 text-center transition hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/[0.05] focus-visible:outline-2 focus-visible:outline-[#D4AF37] disabled:opacity-50">
                <UploadCloud size={26} className="text-[#D4AF37]" aria-hidden="true" />
                <span className="mt-3 text-sm font-medium text-[#EEE5D3]">Upload documents and add information for your DD</span>
                <span className="mt-2 text-xs leading-5 text-[#8F8981]">PDF, PNG, JPEG, TXT, Markdown or CSV · up to 20 files · 50 MB per file</span>
              </button>
              {files.length ? (
                <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[#DDD4C6]">{files.length} document{files.length === 1 ? "" : "s"} attached</p>
                    <button type="button" disabled={submitting || attemptFrozen} onClick={() => { setFiles([]); if (inputRef.current) inputRef.current.value = ""; }} className="min-h-11 px-2 text-xs text-[#BDA76F] hover:text-[#E4C45F] disabled:opacity-40">Clear files</button>
                  </div>
                  <div className="max-h-28 space-y-2 overflow-auto">
                    {files.map((file, index) => <div key={file.name + file.size + index} className="flex items-center gap-2 text-xs text-[#8F8981]">
                      <FileText size={13} className="shrink-0 text-[#BDA76F]" aria-hidden="true" /><span className="truncate">{file.name}</span>
                    </div>)}
                  </div>
                </div>
              ) : null}
            </div>
            )}
          /></>);
  const caseWorkspace=(<>        {!newCaseMode && activeCase && currentSnapshot?.case && !submitting ? <details className="mx-auto mt-8 max-w-3xl border border-[#D4AF37]/20 bg-[#0D0D0D]">
          <summary className="cursor-pointer px-5 py-4 text-sm text-[#BDA76F]">Manage document submission · {activeCase.title}</summary>
          <div className="border-t border-white/8 p-4 sm:p-5">
            <DocumentIntakePanel token="crm-session" caseId={activeCaseId} caseRevision={currentSnapshot.case.revision}
              existingCount={currentSnapshot.documents?.length ?? 0} client={crmIntakeClient}
              onChanged={async () => { await loadCase(activeCaseId); await refreshCases(activeCaseId); }} />
          </div>
        </details> : null}

        {!newCaseMode && job ? (
          <section className="mx-auto mt-10 max-w-3xl border border-[#D4AF37]/18 bg-[#0D0D0D] p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#BDA76F]">Investigation progress</p>
                <h2 className="mt-2 font-serif text-2xl">{stage.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[#8F8981]">{stage.note}</p>
              </div>
              {job.stage === "completed" ? <CheckCircle2 className="mt-1 shrink-0 text-[#D4AF37]" size={23} /> : null}
            </div>
            <div className="mt-5 h-2 overflow-hidden bg-white/7" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full bg-[#D4AF37] transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-[#6F6962]">
              <span>{activeCase?.title || "Investigation"}</span>
              <span>{progress}%</span>
            </div>

            <div className="mt-6 border-t border-white/8 pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#BDA76F]">Investigation milestones</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#BDA76F]">
                  {job.stage === "paused" ? `${progress}% paused progress` : TERMINAL.has(job.stage) ? `${progress}% stopped progress` : `${progress}% live progress`}
                </p>
              </div>
              <div className="mt-3 border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] px-3 py-3 text-xs leading-5 text-[#DDD4C6]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#BDA76F]">Current submodule</p>
                <p className="mt-1">{submodule?.label}{submodule?.lane ? ` · ${submodule.lane}` : ""}</p>
                {submodule?.detail ? <p className="mt-1 break-words text-[#9D968F]">{submodule.detail}</p> : null}
                {submodule?.route ? <p className="mt-1 break-words text-[#BDA76F]">Active route: {submodule.route}</p> : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MILESTONES.map((milestone, index) => {
                  const status = milestoneStatus(index, job, snapshot);
                  return (
                    <div key={milestone.stage} className={`flex items-center gap-2 border px-3 py-2 text-xs ${status === "complete" ? "border-[#849E68]/35 text-[#CFE4B8]" : status === "active" ? "border-[#D4AF37]/40 text-[#E4C45F]" : status === "blocked" ? "border-[#B96F5C]/40 text-[#D9A597]" : "border-white/8 text-[#706A63]"}`}>
                      <span aria-hidden="true">{status === "complete" ? "✓" : status === "active" ? "•" : status === "blocked" ? "!" : status === "not applicable" ? "–" : "○"}</span>
                      <span>{milestone.label}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-[0.12em]">{status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {canContinue ? (
              <div className="mt-6 border border-[#D4AF37]/25 bg-[#D4AF37]/[0.045] p-4">
                <p className="text-sm text-[#DDD4C6]">This run stopped safely before the final report. Continue from the last checkpoint to retry the blocked work.</p>
                <button type="button" onClick={() => void continueInvestigation()} disabled={submitting} className="mt-4 inline-flex h-11 items-center gap-2 bg-[#D4AF37] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#080808] hover:bg-[#E4C45F] disabled:cursor-not-allowed disabled:opacity-40">
                  Continue investigation
                </button>
              </div>
            ) : null}

            {canStop ? (
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5">
                <button type="button" onClick={() => void stopInvestigation("pause")} disabled={submitting} className="inline-flex h-11 items-center gap-2 border border-[#D4AF37]/40 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E4C45F] hover:bg-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-40">
                  <Pause size={14} /> Pause safely
                </button>
                <button type="button" onClick={() => void stopInvestigation("cancel")} disabled={submitting} className="inline-flex h-11 items-center gap-2 border border-[#B96F5C]/50 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D9A597] hover:bg-[#B96F5C]/10 disabled:cursor-not-allowed disabled:opacity-40">
                  <XCircle size={14} /> Cancel investigation
                </button>
                <p className="basis-full text-xs leading-5 text-[#7F7871]">Both controls stop only at a durable checkpoint. Pause is intended for later continuation; cancellation records the stop in the audit history.</p>
              </div>
            ) : null}


            <div className="mt-6 grid gap-3 border-t border-[#D4AF37]/20 pt-5 sm:grid-cols-2">
              <div className="border border-[#D4AF37]/25 bg-[#D4AF37]/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#BDA76F]">Step 1 · Rapid assessment</p>
                <p className="mt-2 text-sm text-[#EEE7DB]">{preliminary ? "Preliminary PDF ready" : "Preparing the preliminary PDF"}</p>
                <p className="mt-2 text-xs leading-5 text-[#9D968F]">Early document-based findings and verification priorities. Public-source research and independent review are pending. This is not transaction clearance.</p>
                {preliminary ? <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&stage=preliminary`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-[#D4AF37]/40 px-3 text-xs text-[#E4C45F]"><FileText size={14} /> View preliminary PDF</a>
                  <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&stage=preliminary&download=1`} download className="inline-flex h-10 items-center gap-2 border border-white/15 px-3 text-xs text-[#DDD4C6]"><Download size={14} /> Download preliminary</a>
                </div> : null}
              </div>
              <div className="border border-white/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#BDA76F]">Step 2 · Comprehensive investigation</p>
                <p className="mt-2 text-sm text-[#EEE7DB]">{reportFinalized ? "Final PDF ready" : running ? "Investigation continuing" : "Final report checks pending recovery"}</p>
                <p className="mt-2 text-xs leading-5 text-[#9D968F]">The final report follows the same template and is released automatically after evidence, independent review and PDF checks pass.{reportFinalized ? " It supersedes the preliminary assessment." : " The preliminary PDF remains available while these checks are completed."}</p>
              </div>
            </div>

            {report?.content_markdown ? (
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-sm leading-6 text-[#C9C0B3]">{report.summary || "Your report is ready and has been saved to the archive."}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#827A71]">Status: {reportIncomplete ? "HOLD — INCOMPLETE" : report.status}</p>
                {!reportMatchesCurrentJob ? <p className="mt-3 border border-[#B96F5C]/30 bg-[#B96F5C]/[0.06] px-3 py-2 text-xs leading-5 text-[#D9A597]">Historical report from an earlier investigation or case revision. Run the current revision before review or PDF release.</p> : null}
                {modelChecked ? verifiedModel ? (
                  <div className="mt-3 border border-[#D4AF37]/25 bg-[#D4AF37]/[0.05] px-3 py-2 text-xs leading-5 text-[#C9C0B3]">
                    <p className="font-semibold text-[#E4C45F]">Verified report snapshot · {reportFinalized ? "final" : modelEligible ? "final release checks pending" : "draft — checks incomplete"}</p>
                    <p>{verifiedModel.counts.submitted_documents} submitted documents · {verifiedModel.counts.findings} findings · {verifiedModel.counts.sources} sources · {verifiedModel.counts.unresolved_gates} unresolved gates</p>
                    <p>Pre-report critic: {verifiedModel.quality.pre_report_critic}; final report critic: {verifiedModel.quality.final_report_critic}. {reportFinalized ? "Automatic release checks passed." : "Finalization is automatic when all review and PDF checks pass."}</p>
                  </div>
                ) : <p className="mt-3 border border-[#B96F5C]/30 bg-[#B96F5C]/[0.06] px-3 py-2 text-xs leading-5 text-[#D9A597]">Legacy or unverified report snapshot. The report can be read as a draft; finalization and PDF release require a verified rerun.</p> : null}
                {reportIncomplete ? <p className="mt-3 border border-[#B96F5C]/30 bg-[#B96F5C]/[0.06] px-3 py-2 text-xs leading-5 text-[#D9A597]">The report pipeline is incomplete. Its technical or review failures must be resolved before final PDF delivery. Authentication gates listed in a completed HOLD report can remain open.</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {reportFinalized ? (
                    <>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-[#D4AF37]/40 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E4C45F] hover:bg-[#D4AF37]/10">
                        <FileText size={14} /> Open PDF
                      </a>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&download=1`} download className="inline-flex h-11 items-center gap-2 bg-[#D4AF37] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#080808] hover:bg-[#E4C45F]">
                        <Download size={14} /> Download Enhanced Due Diligence
                      </a>
                      {nativeFinalized || oraclePairFinalized ? <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&edition=internal&download=1`} download className="inline-flex h-11 items-center gap-2 border border-[#D4AF37]/40 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E4C45F]"><Download size={14} /> Download INTERNAL FULL</a> : null}
                    </>
                  ) : null}
                  {reportDraftPdfReady ? (
                    <>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&draft=1`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-white/15 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C9C0B3] hover:border-[#D4AF37]/30 hover:text-[#E4C45F]">
                        <FileText size={14} /> Open draft PDF
                      </a>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&draft=1&download=1`} download className="inline-flex h-11 items-center gap-2 border border-white/15 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C9C0B3] hover:border-[#D4AF37]/30 hover:text-[#E4C45F]">
                        <Download size={14} /> Download draft PDF
                      </a>
                    </>
                  ) : null}
                  <button type="button" onClick={() => downloadMarkdown(report, activeCase?.title || "Report")} className="inline-flex h-11 items-center gap-2 border border-white/10 px-4 text-[10px] uppercase tracking-[0.14em] text-[#A59D94] hover:border-[#D4AF37]/30 hover:text-[#E4C45F]">
                    <Download size={14} /> Markdown
                  </button>
                </div>
                <details className="mt-6 border-t border-[#D4AF37]/20 pt-5" open>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C45F]">Read complete web report</summary>
                  <p className="mt-3 border-l-2 border-[#D4AF37]/50 bg-[#D4AF37]/[0.05] px-4 py-3 text-xs leading-5 text-[#C9C0B3]">
                    {reportFinalized ? "Final report released after independent automated review. Apply its stated decision, limitations and authentication gates; finalization does not clear the transaction." : "Draft investigation report. Failed technical or review checks must be recovered before final release. Direct authentication gates are stated separately."}
                  </p>
                  <InvestigationReport content={report.content_markdown} />
                </details>
              </div>
            ) : null}
          </section>
        ) : null}
{activeCase&&!newCaseMode?<details className="dash-panel mt-5 p-5"><summary className="cursor-pointer text-sm text-[#D4C5A3]">Manage investigation</summary><p className="mt-3 text-xs text-[#A9A39A]">Archiving retains evidence and audit history. Stop an active investigation before archiving it.</p><div className="mt-4 flex flex-wrap gap-3"><button className="dash-button" disabled={submitting||running} onClick={()=>void archiveCase(activeCase)}>Archive investigation</button></div></details>:null}
</>);
  return <><PremiumDashboard cases={cases} snapshot={currentSnapshot} activeCaseId={activeCaseId} newCaseMode={newCaseMode}
    onSelect={requestCase}
    onRestored={async()=>{await refreshCases(activeCaseId);}}
    onNew={requestNew}
    onPrepare={async row=>{if(await requestNew()){setClientName(row.name);setQuestion(`Investigate ${row.name} (${row.country}). Historical dossier lead ${row.code}, dated 13 October 2026: ${row.offering||row.role}. Treat historical identity, contact and opportunity claims as unverified; establish current evidence and preserve all unknowns.`);return true;}return false;}}
    composer={composer} workspace={caseWorkspace} notice={notice||readError}/>{confirmation.dialog}</>;
}
