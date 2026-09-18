"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UploadCloud,
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
};

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
};

const TERMINAL = new Set(["completed", "incomplete", "failed", "cancelled", "research_limit_reached"]);

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
  research_limit_reached: { label: "Research limit reached", note: "The report records what was completed and what remains open." },
};

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
  const form = new FormData();
  form.set("action", "upload");
  form.set("caseId", caseId);
  form.set("file", file);
  const response = await fetch("/api/crm/backend", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `Upload failed for ${file.name}.`));
  return payload;
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

export default function IntegritasAdminWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [activeCaseId, setActiveCaseId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId) ?? (snapshot?.case as CaseRow | undefined) ?? null,
    [cases, activeCaseId, snapshot],
  );
  const job = newestJob(snapshot);
  const report = newestReport(snapshot);
  const progress = job?.progress ?? 0;
  const stage = STAGE_COPY[job?.stage ?? "queued"] ?? STAGE_COPY.queued;
  const running = Boolean(job && !TERMINAL.has(job.stage));
  const ready = isInvestigationRuntimeReady(runtime);

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
      crmRequest({ action: "runtime_status" }),
      crmRequest({ action: "list_cases" }),
    ]).then(([runtimePayload, casePayload]) => {
      if (cancelled) return;
      const runtimes = Array.isArray(runtimePayload.runtimes) ? runtimePayload.runtimes : [];
      setRuntime((runtimes.find((item: RuntimeStatus) => item.worker_id === "oracle-primary") ?? runtimes[0] ?? null) as RuntimeStatus | null);
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
      const invalid = next.find((file) => file.size > 5 * 1024 * 1024);
      if (invalid) throw new Error(`${invalid.name} is larger than 5 MB.`);
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
        purpose: "Comprehensive authorized due-diligence investigation of the submitted evidence.",
        authorizedScope: "Review all supplied documents and conduct lawful public-source verification required to test material claims, entities, relationships, contradictions and unresolved checks.",
        intendedSubjects: "People, companies, representatives, identifiers and relationships identified in the submitted evidence.",
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
            <span className="mt-2 text-xs leading-5 text-[#7F7871]">PDF, TXT, Markdown or CSV · up to 20 files · 5 MB per file</span>
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
              {TERMINAL.has(job.stage) ? <CheckCircle2 className="mt-1 shrink-0 text-[#D4AF37]" size={23} /> : null}
            </div>
            <div className="mt-5 h-2 overflow-hidden bg-white/7" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full bg-[#D4AF37] transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-[#6F6962]">
              <span>{activeCase?.title || "Investigation"}</span>
              <span>{progress}%</span>
            </div>

            {report?.content_markdown ? (
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-sm leading-6 text-[#C9C0B3]">{report.summary || "Your report is ready and has been saved to the archive."}</p>
                <button
                  type="button"
                  onClick={() => downloadMarkdown(report, activeCase?.title || "Report")}
                  className="mt-4 inline-flex h-11 items-center gap-2 bg-[#D4AF37] px-5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#080808] hover:bg-[#E4C45F]"
                >
                  <Download size={14} />
                  Download report
                </button>
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCaseId(item.id)}
                  className={`border p-4 text-left transition ${item.id === activeCaseId ? "border-[#D4AF37]/45 bg-[#D4AF37]/[0.04]" : "border-white/8 bg-[#0D0D0D] hover:border-[#D4AF37]/25"}`}
                >
                  <p className="truncate text-sm text-[#DDD4C6]">{item.title}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#6F6962]">
                    {new Date(item.created_at).toLocaleDateString("en-ZA")}
                  </p>
                </button>
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
