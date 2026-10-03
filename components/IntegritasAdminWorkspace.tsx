"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { integritasSupabase } from "@/lib/integritas-supabase";
import InvestigationReport from "@/components/InvestigationReport";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Pause,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  MAX_CASE_DOCUMENTS,
  SUPPORTED_CASE_FILE_ACCEPT,
  isInvestigationRuntimeReady,
  type RuntimeStatus,
} from "@/lib/integritas-browser";

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
  status: string;
  summary?: string;
  content_markdown?: string;
  limitations?: string;
  created_at?: string;
  updated_at?: string;
  based_on_revision?: number;
};

type Snapshot = {
  case?: CaseRow & Record<string, unknown>;
  documents?: Array<{ id: string; name: string; created_at: string }>;
  jobs?: JobRow[];
  reports?: ReportRow[];
  findings?: unknown[];
  sources?: unknown[];
  checks?: unknown[];
  checkpoints?: CheckpointRow[];
};

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
  incomplete: { label: "Report needs review", note: "The investigation finished with unresolved items clearly marked." },
  failed: { label: "Investigation needs attention", note: "The run stopped before a final report could be produced." },
  cancelled: { label: "Investigation cancelled", note: "The run was cancelled." },
  paused: { label: "Investigation paused", note: "The worker stopped at a durable checkpoint. Continue to resume this investigation." },
  research_limit_reached: { label: "Research limit reached", note: "The report records what was completed and what remains open." },
};

const RUNTIME_STATUS_POLL_MS = 20_000;

async function loadRuntimeStatus(): Promise<RuntimeStatus | null> {
  const payload = await crmRequest({ action: "runtime_status" });
  const runtimes = Array.isArray(payload.runtimes) ? payload.runtimes : [];
  return (runtimes.find((item: RuntimeStatus) => item.worker_id === "oracle-primary") ?? runtimes[0] ?? null) as RuntimeStatus | null;
}

async function crmRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/crm/backend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || "Request failed."));
  return payload;
}

async function uploadFile(caseId: string, file: File) {
  const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : file.name.toLowerCase().endsWith(".csv") ? "text/csv" : file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain");
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "document";
  const idempotencyKey = `crm:${caseId}:${safeName}:${file.size}:${file.lastModified}`.slice(0, 160);
  const reservationResponse = await crmRequest({
    action: "reserve_upload",
    caseId,
    name: file.name,
    mime,
    size: file.size,
    idempotency_key: idempotencyKey,
  });
  if (reservationResponse.finalized) return reservationResponse;

  if (file.size > 6 * 1024 * 1024) {
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: String(reservationResponse.resumableEndpoint),
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { "x-signature": String(reservationResponse.uploadToken) },
        metadata: {
          bucketName: String(reservationResponse.bucket),
          objectName: String(reservationResponse.objectPath),
          contentType: mime,
        },
        fingerprint: async () => [String(reservationResponse.reservationId), file.name, String(file.size), String(file.lastModified)],
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.findPreviousUploads().then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(reject);
    });
  } else {
    const result = await integritasSupabase.storage
      .from(String(reservationResponse.bucket))
      .uploadToSignedUrl(String(reservationResponse.objectPath), String(reservationResponse.uploadToken), file, {
        contentType: mime,
        upsert: false,
      });
    if (result.error) throw result.error;
  }

  return crmRequest({ action: "finalize_upload", reservationId: reservationResponse.reservationId });
}

function newestJob(snapshot: Snapshot | null) {
  const jobs = (snapshot?.jobs ?? []).filter((job) => job.runtime_provider === "openclaw-oracle");
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
  const label = /ocr|extract/.test(stage) ? MILESTONES[0].label
    : /route|plan/.test(stage) ? MILESTONES[1].label
    : /entity|normaliz|mapping|analys|analyz/.test(stage) ? MILESTONES[2].label
    : /research|lane|verif|cross_check/.test(stage) ? MILESTONES[3].label
    : /critic|independent|revision/.test(stage) ? MILESTONES[4].label
    : /dossier|assembl|draft|synthes/.test(stage) ? MILESTONES[5].label
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
  const [files, setFiles] = useState<File[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [activeCaseId, setActiveCaseId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [runtimeCheckedAt, setRuntimeCheckedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [archiveMenu, setArchiveMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId) ?? (snapshot?.case as CaseRow | undefined) ?? null,
    [cases, activeCaseId, snapshot],
  );
  const job = newestJob(snapshot);
  const report = newestReport(snapshot);
  const progress = job?.progress ?? 0;
  const submodule = job ? currentSubmodule(job, snapshot) : null;
  const reportFinalized = report?.status === "finalized";
  const stage = reportFinalized
    ? STAGE_COPY.completed
    : STAGE_COPY[job?.stage ?? "queued"] ?? STAGE_COPY.queued;
  const running = Boolean(job && !TERMINAL.has(job.stage));
  const ready = isInvestigationRuntimeReady(runtime, runtimeCheckedAt);
  const canContinue = Boolean(
    !reportFinalized
      && job?.id
      && ["failed", "incomplete", "cancelled", "paused", "research_limit_reached"].includes(job.stage)
      && !committedPdfReady(job, snapshot),
  );
  const canStop = Boolean(running && job?.id);

  const runReportAction = async (action: "review_report" | "finalize_report") => {
    if (!report?.id) return;
    setSubmitting(true);
    try {
      await crmRequest({ action, reportId: report.id });
      await loadCase(activeCaseId);
      await refreshCases(activeCaseId);
      setNotice(action === "review_report" ? "Report marked as reviewed." : "Report finalized. PDF download is now available.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

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
    const confirmed = window.confirm(
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
    if (!window.confirm("Archive this investigation? It will disappear from the workspace, while its evidence and audit history remain retained securely.")) return;
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

  const deleteCasePermanently = async (item: CaseRow) => {
    const typed = window.prompt(`Type DELETE to permanently remove “${item.title}”, including uploaded files, report and retained evidence.`);
    if (typed !== "DELETE") return;
    setSubmitting(true);
    setArchiveMenu(null);
    setNotice("Permanently deleting the investigation and its files…");
    try {
      await crmRequest({ action: "purge_case", caseId: item.id, confirmation: "DELETE" });
      const nextCases = await refreshCases(activeCaseId === item.id ? undefined : activeCaseId);
      if (activeCaseId === item.id) {
        setActiveCaseId(nextCases[0]?.id || "");
        setSnapshot(null);
      }
      setNotice("Investigation and uploaded files were permanently deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshCases = async (prefer?: string) => {
    const payload = await crmRequest({ action: "list_cases" });
    const rows = (Array.isArray(payload.cases) ? payload.cases : [])
      .filter((row: CaseRow) => !String(row.title || "").startsWith("[SYNTHETIC]")) as CaseRow[];
    setCases(rows);
    if (prefer) setActiveCaseId(prefer);
    else setActiveCaseId((current) => current || rows[0]?.id || "");
    return rows;
  };

  const loadCase = async (caseId: string) => {
    if (!caseId) {
      setSnapshot(null);
      return null;
    }
    const data = await crmRequest({ action: "snapshot", caseId });
    setSnapshot(data as Snapshot);
    return data as Snapshot;
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadRuntimeStatus(),
      crmRequest({ action: "list_cases" }),
    ]).then(([runtimeStatus, casePayload]) => {
      if (cancelled) return;
      setRuntime(runtimeStatus);
      setRuntimeCheckedAt(Date.now());
      const rows = (Array.isArray(casePayload.cases) ? casePayload.cases : [])
        .filter((row: CaseRow) => !String(row.title || "").startsWith("[SYNTHETIC]")) as CaseRow[];
      setCases(rows);
      setActiveCaseId(rows[0]?.id || "");
    }).catch((error) => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestPending = false;
    const refreshRuntime = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      setRuntimeCheckedAt(Date.now());
      if (requestPending) return;
      requestPending = true;
      void loadRuntimeStatus()
        .then((status) => { if (!cancelled) setRuntime(status); })
        .catch(() => {
          // The last heartbeat expires through the readiness check, so failed refreshes fail closed.
        })
        .finally(() => {
          requestPending = false;
          if (!cancelled) setRuntimeCheckedAt(Date.now());
        });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshRuntime();
    };
    const timer = window.setInterval(refreshRuntime, RUNTIME_STATUS_POLL_MS);
    window.addEventListener("focus", refreshRuntime);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshRuntime);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeCaseId) return;
    let cancelled = false;
    crmRequest({ action: "snapshot", caseId: activeCaseId })
      .then((data) => { if (!cancelled) setSnapshot(data as Snapshot); })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [activeCaseId]);

  useEffect(() => {
    if (!activeCaseId || !running) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await crmRequest({ action: "snapshot", caseId: activeCaseId });
        if (!cancelled) {
          setSnapshot(data as Snapshot);
          const nextJob = newestJob(data as Snapshot);
          if (nextJob && TERMINAL.has(nextJob.stage)) {
            await refreshCases(activeCaseId);
          }
        }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : String(error));
      }
    };
    const timer = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeCaseId, running]);

  const chooseFiles = (next: File[]) => {
    try {
      if (!next.length) return;
      if (next.length > MAX_CASE_DOCUMENTS) throw new Error(`Choose no more than ${MAX_CASE_DOCUMENTS} files.`);
      const invalid = next.find((file) => file.size > 50 * 1024 * 1024);
      if (invalid) throw new Error(`${invalid.name} is larger than 50 MB.`);
      setFiles(next);
      setNotice("");
    } catch (error) {
      setFiles([]);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const submitInvestigation = async () => {
    if (!files.length || submitting || !ready) return;
    setSubmitting(true);
    setNotice("Preparing your investigation…");
    try {
      const created = await crmRequest({
        action: "create_case",
        authorized: true,
        title: caseTitle(files),
        purpose: "Maximum-depth, source-grounded due-diligence investigation. Extract every material fact from every page, reconcile all documents, conduct specialist public-source research, preserve contradictions and produce a comprehensive evidence-linked report with visualisations and explicit closure gates.",
        authorizedScope: "Review every supplied document page and attachment; normalize and hash inputs; identify entities, aliases, representatives, authority, ownership/control, banking/payment, product/title/capacity, storage/terminal, logistics/maritime, pricing/economics, trade finance, document forensics, sanctions/PEP/adverse media, digital attribution and contradictions. Use independent research lanes, bounded provider failover and critic review. Do not mark the case complete when research synthesis, source validation, independent QA or PDF assembly is degraded; retain unresolved gates and retry from durable checkpoints.",
        intendedSubjects: "Entities identified in the submitted evidence",
        jurisdictions: "International; determine relevant jurisdictions from the evidence.",
      });
      const caseId = String(created.caseId || "");
      if (!caseId) throw new Error("The case could not be created.");

      for (let index = 0; index < files.length; index += 1) {
        setNotice(`Uploading document ${index + 1} of ${files.length}…`);
        await uploadFile(caseId, files[index]);
      }

      const prepared = await crmRequest({ action: "snapshot", caseId }) as Snapshot;
      const revision = Number(prepared.case?.revision ?? 0);
      setNotice("Starting the full investigation…");
      await crmRequest({
        action: "start_case_investigation",
        case_id: caseId,
        case_revision: revision,
        depth: "maximum",
        idempotency_key: `crm:${caseId}:rev:${revision}:maximum`,
      });

      await refreshCases(caseId);
      await loadCase(caseId);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      setNotice("Investigation started. You can leave this page and return later.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const resetNew = () => {
    setFiles([]);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-[#080808] text-[#F7F5F0]">
      <header className="border-b border-[#D4AF37]/15 bg-[#0B0B0B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div>
            <p className="font-serif text-2xl leading-none">Integritas</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-[#BDA76F]">Investigation workspace</p>
          </div>
          <form action="/api/crm/logout" method="post">
            <button className="inline-flex min-h-10 items-center gap-2 border border-white/10 px-3 text-[10px] uppercase tracking-[0.16em] text-[#A59D94] transition hover:border-[#D4AF37]/35 hover:text-[#E4C45F]">
              <LockKeyhole size={13} aria-hidden="true" />
              Lock
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center border border-[#D4AF37]/30 text-[#D4AF37]">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <h1 className="font-serif text-3xl font-normal sm:text-4xl">Start a new investigation</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#9D968F]">
              Upload the evidence you received. Integritas will review every document, verify material claims, cross-check sources and prepare a structured due-diligence report.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTED_CASE_FILE_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => chooseFiles(Array.from(event.target.files ?? []))}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-48 w-full flex-col items-center justify-center border border-dashed border-[#D4AF37]/35 bg-[#D4AF37]/[0.035] px-6 text-center transition hover:border-[#D4AF37]/65 hover:bg-[#D4AF37]/[0.06]"
          >
            <UploadCloud size={32} className="text-[#D4AF37]" aria-hidden="true" />
            <span className="mt-4 text-base font-medium text-[#EEE5D3]">Upload documents to investigate</span>
            <span className="mt-2 text-xs leading-5 text-[#7F7871]">PDF, TXT, Markdown or CSV · up to 20 files · 50 MB per file</span>
          </button>

          {files.length ? (
            <div className="mt-4 border border-white/8 bg-[#0D0D0D] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[#DDD4C6]">{files.length} document{files.length === 1 ? "" : "s"} selected</p>
                <button type="button" onClick={resetNew} className="text-[10px] uppercase tracking-[0.16em] text-[#8D857D] hover:text-[#D4AF37]">
                  Clear
                </button>
              </div>
              <div className="mt-3 max-h-28 space-y-2 overflow-auto">
                {files.map((file) => (
                  <div key={file.name + file.size} className="flex items-center gap-2 text-xs text-[#8F8981]">
                    <FileText size={13} className="shrink-0 text-[#BDA76F]" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!files.length || submitting || !ready}
            onClick={() => void submitInvestigation()}
            className="mt-4 h-12 w-full bg-[#D4AF37] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#080808] transition hover:bg-[#E4C45F] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {submitting ? "Preparing investigation…" : ready ? "Start investigation" : "Investigation service unavailable"}
          </button>

          {notice ? <p className="mt-3 text-center text-xs leading-5 text-[#9D968F]">{notice}</p> : null}
        </div>

        {job ? (
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

            {report?.content_markdown ? (
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-sm leading-6 text-[#C9C0B3]">{report.summary || "Your report is ready and has been saved to the archive."}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#827A71]">Status: {report.status}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.status === "draft" ? (
                    <button type="button" onClick={() => void runReportAction("review_report")} disabled={submitting} className="inline-flex h-11 items-center gap-2 border border-[#D4AF37]/40 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E4C45F] hover:bg-[#D4AF37]/10">
                      Mark reviewed
                    </button>
                  ) : null}
                  {report.status === "reviewed" ? (
                    <button type="button" onClick={() => void runReportAction("finalize_report")} disabled={submitting} className="inline-flex h-11 items-center gap-2 bg-[#D4AF37] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#080808] hover:bg-[#E4C45F]">
                      Finalize report
                    </button>
                  ) : null}
                  {report.status === "finalized" ? (
                    <>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-[#D4AF37]/40 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E4C45F] hover:bg-[#D4AF37]/10">
                        <FileText size={14} /> Open PDF
                      </a>
                      <a href={`/api/crm/report?caseId=${encodeURIComponent(activeCaseId)}&download=1`} download className="inline-flex h-11 items-center gap-2 bg-[#D4AF37] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#080808] hover:bg-[#E4C45F]">
                        <Download size={14} /> Download report PDF
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
                    {report.status === "finalized" ? "Finalized analyst report." : "Draft investigation report for analyst review. Unresolved verification gates are not transaction clearance."}
                  </p>
                  <InvestigationReport content={report.content_markdown} />
                </details>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mx-auto mt-12 max-w-5xl border-t border-white/8 pt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#BDA76F]">
                <Archive size={16} />
                <p className="text-[10px] uppercase tracking-[0.2em]">Archive</p>
              </div>
              <h2 className="mt-2 font-serif text-2xl">Previous investigations</h2>
            </div>
            <button type="button" onClick={resetNew} className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#A59D94] hover:text-[#D4AF37]">
              <Plus size={13} />
              New
            </button>
          </div>

          {cases.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {cases.map((item) => (
                <div
                  key={item.id}
                  className={`relative border p-4 text-left transition ${item.id === activeCaseId ? "border-[#D4AF37]/45 bg-[#D4AF37]/[0.04]" : "border-white/8 bg-[#0D0D0D] hover:border-[#D4AF37]/25"}`}
                >
                  <button type="button" onClick={() => { setArchiveMenu(null); setActiveCaseId(item.id); }} className="block w-full pr-10 text-left">
                    <p className="truncate text-sm text-[#DDD4C6]">{item.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-[#6F6962]">
                      <span>{new Date(item.created_at).toLocaleDateString("en-ZA")}</span>
                      <span>{item.latest_report?.status || item.latest_job?.stage || item.status || "In progress"}</span>
                    </div>
                    {item.latest_report?.summary ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#8F8981]">{item.latest_report.summary}</p> : null}
                    {!item.latest_report?.summary && item.latest_job?.stage ? <p className="mt-3 text-xs leading-5 text-[#8F8981]">{item.latest_job.stage.replaceAll("_", " ")} · {item.latest_job.progress ?? 0}%</p> : null}
                  </button>
                  <div className="absolute right-3 top-3">
                    <button type="button" aria-label={`Options for ${item.title}`} title="Investigation options" onClick={() => setArchiveMenu((current) => current === item.id ? null : item.id)} className="inline-flex size-9 items-center justify-center text-[#A59D94] hover:bg-white/5 hover:text-[#E4C45F]">
                      <MoreHorizontal size={17} aria-hidden="true" />
                    </button>
                    {archiveMenu === item.id ? (
                      <div role="menu" className="absolute right-0 z-10 mt-1 w-44 border border-white/10 bg-[#151515] p-1 shadow-2xl">
                        <button type="button" role="menuitem" onClick={() => { setArchiveMenu(null); setActiveCaseId(item.id); }} className="flex w-full items-center px-3 py-2 text-left text-xs text-[#DDD4C6] hover:bg-white/5">Open investigation</button>
                        <button type="button" role="menuitem" onClick={() => void archiveCase(item)} disabled={submitting} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#D9A597] hover:bg-[#B96F5C]/10 disabled:opacity-40"><Archive size={13} aria-hidden="true" /> Archive (keep evidence)</button>
                        <button type="button" role="menuitem" onClick={() => void deleteCasePermanently(item)} disabled={submitting} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#D9A597] hover:bg-[#B96F5C]/10 disabled:opacity-40"><Trash2 size={13} aria-hidden="true" /> Permanently delete</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-white/8 bg-[#0D0D0D] p-6 text-sm text-[#7F7871]">
              Completed investigations will appear here automatically.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
