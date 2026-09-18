"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FolderOpen,
  Gavel,
  History,
  LogOut,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  Shield,
  Square,
  UploadCloud,
} from "lucide-react";
import {
  canStartInvestigation,
  createIntegritasBrowserClient,
  getIntegritasFunctionUrls,
  isInvestigationResultStale,
  isInvestigationRuntimeReady,
  loadPersistedInvestigationResults,
  SUPPORTED_CASE_FILE_ACCEPT,
  validateCaseDocumentSelection,
  type InvestigationDepth,
  type PersistedInvestigationResults,
  type RuntimeStatus,
} from "@/lib/integritas-browser";
import {
  integritasSupabase,
  integritasSupabaseUrl,
} from "@/lib/integritas-supabase";

type CaseRow = {
  id: string;
  title: string;
  revision: number;
  created_at: string;
};

type DocumentRow = {
  id: string;
  case_id: string;
  name: string;
  created_at: string;
};

type JobRow = {
  id: string;
  case_id: string;
  case_revision: number;
  control_command_id: string | null;
  stage: string;
  progress: number;
  runtime_provider: string;
};

const stages = [
  ["queued", "Queued"],
  ["extracting", "Extracting evidence"],
  ["analyzing_documents", "Analyzing documents"],
  ["mapping_entities", "Mapping entities"],
  ["planning_research", "Planning research"],
  ["researching", "Researching"],
  ["verifying", "Verifying"],
  ["cross_checking", "Cross-checking"],
  ["independent_review", "Independent review"],
  ["drafting_report", "Drafting report"],
] as const;

const terminalStages = new Set([
  "completed",
  "incomplete",
  "failed",
  "cancelled",
  "research_limit_reached",
]);

const nav = [
  ["Dashboard", "#dashboard", Activity],
  ["Cases", "#cases", FolderOpen],
  ["Investigation", "#investigation", SearchCheck],
  ["Entities", "#entities", Network],
  ["Findings", "#findings", Gavel],
  ["Sources", "#evidence", BookOpenCheck],
  ["Checks", "#checks", ClipboardCheck],
  ["Report", "#reports", FileSearch],
  ["Audit", "#audit", History],
] as const;

const browserClient = createIntegritasBrowserClient(
  getIntegritasFunctionUrls(integritasSupabaseUrl),
);

function stageLabel(stage: string) {
  const found = stages.find(([key]) => key === stage);
  if (found) return found[1];
  if (stage === "completed") return "Completed";
  if (stage === "incomplete") return "Incomplete";
  if (stage === "failed") return "Failed";
  if (stage === "cancelled") return "Cancelled";
  if (stage === "research_limit_reached") return "Research limit reached";
  return stage || "Waiting";
}

function statusClass(ok: boolean) {
  return ok
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
    : "border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#DCC47A]";
}

function ResultSections({
  results,
  selectedCase,
  job,
  token,
  onRefresh,
  setNotice,
}: {
  results: PersistedInvestigationResults;
  selectedCase: CaseRow;
  job: JobRow;
  token: string;
  onRefresh: () => Promise<void>;
  setNotice: (message: string) => void;
}) {
  const [acting, setActing] = useState(false);
  const sourceById = new Map(results.sources.map((source) => [source.id, source]));
  const contradictions = results.findings.filter(
    (finding) => finding.finding_type === "contradiction",
  );
  const unresolved = results.checks.filter(
    (check) => check.check_type === "unresolved" || check.status !== "complete",
  );
  const stale = isInvestigationResultStale(
    selectedCase.revision,
    job.case_revision,
    results.report?.based_on_revision ?? null,
  );

  const reportAction = async (kind: "review" | "finalize") => {
    if (!results.report) return;
    setActing(true);
    setNotice(kind === "review" ? "Recording analyst review…" : "Finalizing reviewed report…");
    try {
      if (kind === "review") {
        await browserClient.reviewReport(token, results.report.id);
      } else {
        await browserClient.finalizeReport(token, results.report.id);
      }
      await onRefresh();
      setNotice(kind === "review" ? "Report marked reviewed." : "Report finalized.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      {stale && (
        <div className="col-span-full border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <strong className="mr-2">Stale result.</strong>
          The case is now revision {selectedCase.revision}, while this investigation is
          revision {job.case_revision}. Uploading new evidence intentionally stales older
          output.
        </div>
      )}

      <article id="entities" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">Entities</h2>
          <span className="text-xs text-[#D4AF37]">{results.entities.length}</span>
        </div>
        {results.entities.length === 0 ? (
          <p className="text-sm text-[#8F8981]">No persisted entities yet.</p>
        ) : (
          <ul className="space-y-2">
            {results.entities.map((entity) => (
              <li key={entity.id} className="border border-white/8 bg-black/20 p-3">
                <strong className="block text-sm text-[#F7F5F0]">{entity.display_name}</strong>
                <span className="mt-1 block break-all font-mono text-[10px] text-[#D4AF37]">
                  {entity.entity_key}
                </span>
                <small className="mt-1 block text-[#8F8981]">
                  {entity.entity_type} · {entity.match_status}
                  {entity.match_confidence == null ? "" : ` · ${entity.match_confidence}%`}
                </small>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article id="findings" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">Findings</h2>
          <span className="text-xs text-[#D4AF37]">{results.findings.length}</span>
        </div>
        {results.findings.filter((finding) => finding.finding_type !== "contradiction").length === 0 ? (
          <p className="text-sm text-[#8F8981]">No persisted findings yet.</p>
        ) : (
          <div className="space-y-3">
            {results.findings
              .filter((finding) => finding.finding_type !== "contradiction")
              .map((finding) => (
                <div key={finding.id} className="border-b border-white/8 pb-3 last:border-0">
                  <strong className="block text-sm leading-6">{finding.claim}</strong>
                  <small className="mt-1 block text-[#9F947D]">
                    {finding.evidence_status} · {finding.materiality} · {finding.reliability}
                  </small>
                  {finding.source_ids.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-[#D4AF37]">
                      {finding.source_ids.map((sourceId) => {
                        const source = sourceById.get(sourceId);
                        return source ? <li key={sourceId}>↳ {source.title}</li> : null;
                      })}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        )}
      </article>

      <article id="evidence" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">Evidence &amp; Sources</h2>
          <span className="text-xs text-[#D4AF37]">{results.sources.length}</span>
        </div>
        {results.sources.length === 0 ? (
          <p className="text-sm text-[#8F8981]">No sources persisted yet.</p>
        ) : (
          <ul className="space-y-2">
            {results.sources.map((source) => (
              <li key={source.id} className="border border-white/8 p-3">
                <strong className="block text-sm">{source.title}</strong>
                <small className="mt-1 block text-[#9F947D]">
                  {source.source_type}
                  {source.page_reference ? ` · ${source.page_reference}` : ""}
                </small>
                {source.excerpt && (
                  <span className="mt-2 block text-xs leading-5 text-[#BEB6A7]">{source.excerpt}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article id="contradictions" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">Contradictions</h2>
          <span className="text-xs text-[#D4AF37]">{contradictions.length}</span>
        </div>
        {contradictions.length === 0 ? (
          <p className="text-sm text-[#8F8981]">No contradictions persisted.</p>
        ) : (
          <ul className="space-y-2">
            {contradictions.map((finding) => (
              <li key={finding.id} className="border border-amber-400/15 bg-amber-400/5 p-3 text-sm">
                {finding.claim}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article id="checks" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">Unresolved Checks</h2>
          <span className="text-xs text-[#D4AF37]">{unresolved.length}</span>
        </div>
        {unresolved.length === 0 ? (
          <p className="text-sm text-[#8F8981]">No unresolved checks.</p>
        ) : (
          <ul className="space-y-2">
            {unresolved.map((check) => (
              <li key={check.id} className="border border-white/8 p-3">
                <strong className="block text-sm">{check.description}</strong>
                <small className="mt-1 block text-[#9F947D]">{check.status}</small>
                {check.outcome && (
                  <span className="mt-2 block text-xs leading-5 text-[#BEB6A7]">{check.outcome}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article id="reports" className="col-span-full border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl">Draft Report</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#D4AF37]">
              {results.report?.status ?? "Not generated"}
            </p>
          </div>
          {results.report && !stale && (
            <div className="flex flex-wrap gap-2">
              {results.report.status === "draft" && (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void reportAction("review")}
                  className="border border-[#D4AF37]/35 px-4 py-2 text-xs uppercase tracking-[0.14em] text-[#D4AF37] disabled:opacity-50"
                >
                  Mark reviewed
                </button>
              )}
              {results.report.status === "reviewed" && (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void reportAction("finalize")}
                  className="bg-[#D4AF37] px-4 py-2 text-xs uppercase tracking-[0.14em] text-black disabled:opacity-50"
                >
                  Finalize report
                </button>
              )}
            </div>
          )}
        </div>
        {results.report ? (
          <>
            <p className="mb-4 text-sm leading-6 text-[#BEB6A7]">{results.report.summary}</p>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words border border-[#D4AF37]/12 bg-[#080808] p-4 font-sans text-sm leading-6 text-[#E8DCC1]">
              {results.report.content_markdown}
            </pre>
            {results.report.limitations && (
              <p className="mt-4 text-xs leading-5 text-[#C9B98F]">
                <strong>Limitations:</strong> {results.report.limitations}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#8F8981]">No report has been persisted for this job yet.</p>
        )}
      </article>

      <article id="audit" className="col-span-full border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">History &amp; Audit</h2>
          <span className="text-xs text-[#D4AF37]">
            {results.auditEvents.length + results.checkpoints.length} events
          </span>
        </div>
        <div className="divide-y divide-white/8">
          {results.checkpoints.map((checkpoint) => (
            <div key={checkpoint.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span>{stageLabel(checkpoint.stage)}</span>
              <small className="text-[#9F947D]">{checkpoint.progress}%</small>
            </div>
          ))}
          {results.auditEvents.map((event) => (
            <div key={String(event.id)} className="flex items-start justify-between gap-4 py-2 text-sm">
              <span>{event.event_type}</span>
              <small className="text-right text-[#9F947D]">{new Date(event.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

export default function IntegritasAdminWorkspace() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [commandStatus, setCommandStatus] = useState("");
  const [results, setResults] = useState<PersistedInvestigationResults | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [depth, setDepth] = useState<InvestigationDepth>("deep");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newCase, setNewCase] = useState({
    title: "",
    purpose: "Authorized counterparty due-diligence and verification.",
    authorizedScope: "Review supplied evidence and conduct lawful public-source verification for due-diligence purposes.",
    intendedSubjects: "",
    jurisdictions: "South Africa",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );
  const runtimeReady = isInvestigationRuntimeReady(runtime);
  const currentRevisionJob = Boolean(
    job && selectedCase && job.case_revision === selectedCase.revision,
  );
  const startAllowed = canStartInvestigation({
    authenticated: Boolean(token),
    hasCase: Boolean(selectedCase),
    documentCount: documents.length,
    runtimeReady,
    busy,
    hasCurrentRevisionJob: currentRevisionJob,
  });

  const refreshCases = async (accessToken: string, preferCaseId?: string) => {
    const rows = (await browserClient.listCases(accessToken)) as CaseRow[];
    setCases(rows);
    setSelectedCaseId((current) => {
      if (preferCaseId && rows.some((row) => row.id === preferCaseId)) return preferCaseId;
      if (rows.some((row) => row.id === current)) return current;
      return rows[0]?.id ?? "";
    });
  };

  const refreshSelectedCase = async () => {
    if (!token || !selectedCaseId) return;
    const [caseResult, documentResult, jobResult] = await Promise.all([
      integritasSupabase
        .from("integritas_cases")
        .select("id,title,revision,created_at")
        .eq("id", selectedCaseId)
        .single(),
      integritasSupabase
        .from("integritas_documents")
        .select("id,case_id,name,created_at")
        .eq("case_id", selectedCaseId)
        .order("created_at"),
      integritasSupabase
        .from("integritas_case_jobs")
        .select("id,case_id,case_revision,control_command_id,stage,progress,runtime_provider")
        .eq("case_id", selectedCaseId)
        .eq("runtime_provider", "openclaw-oracle")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (caseResult.error) throw caseResult.error;
    if (documentResult.error) throw documentResult.error;
    if (jobResult.error) throw jobResult.error;

    setCases((current) =>
      current.map((item) =>
        item.id === selectedCaseId ? (caseResult.data as CaseRow) : item,
      ),
    );
    setDocuments((documentResult.data ?? []) as DocumentRow[]);
    setJob(((jobResult.data ?? [])[0] ?? null) as JobRow | null);
  };

  const refreshResults = async () => {
    if (!selectedCaseId || !job?.id) {
      setResults(null);
      return;
    }
    const next = await loadPersistedInvestigationResults(
      integritasSupabase,
      selectedCaseId,
      job.id,
    );
    setResults(next);
  };

  useEffect(() => {
    let mounted = true;
    integritasSupabase.auth.getSession().then(({ data }) => {
      if (mounted) setToken(data.session?.access_token ?? null);
    });
    const { data } = integritasSupabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setToken(session?.access_token ?? null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    browserClient
      .listCases(token)
      .then((data) => {
        if (cancelled) return;
        const rows = data as CaseRow[];
        setCases(rows);
        setSelectedCaseId((current) =>
          rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "",
        );
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const runtimes = await browserClient.runtimeStatus(token);
        const next = (runtimes.find((item: RuntimeStatus) => item.worker_id === "oracle-primary") ??
          runtimes[0] ??
          null) as RuntimeStatus | null;
        if (!cancelled) setRuntime(next);
      } catch (error) {
        if (!cancelled) {
          setRuntime(null);
          setNotice(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedCaseId) return;
    let cancelled = false;
    Promise.all([
      integritasSupabase
        .from("integritas_documents")
        .select("id,case_id,name,created_at")
        .eq("case_id", selectedCaseId)
        .order("created_at"),
      integritasSupabase
        .from("integritas_case_jobs")
        .select("id,case_id,case_revision,control_command_id,stage,progress,runtime_provider")
        .eq("case_id", selectedCaseId)
        .eq("runtime_provider", "openclaw-oracle")
        .order("created_at", { ascending: false })
        .limit(1),
    ]).then(([documentResult, jobResult]) => {
      if (cancelled) return;
      if (documentResult.error) {
        setNotice(documentResult.error.message);
        return;
      }
      if (jobResult.error) {
        setNotice(jobResult.error.message);
        return;
      }
      setDocuments((documentResult.data ?? []) as DocumentRow[]);
      setJob(((jobResult.data ?? [])[0] ?? null) as JobRow | null);
    });
    return () => {
      cancelled = true;
    };
  }, [token, selectedCaseId]);

  useEffect(() => {
    if (!token || !job?.control_command_id || !selectedCaseId) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [command, jobResult] = await Promise.all([
          browserClient.commandStatus(token, job.control_command_id as string),
          integritasSupabase
            .from("integritas_case_jobs")
            .select("id,case_id,case_revision,control_command_id,stage,progress,runtime_provider")
            .eq("id", job.id)
            .eq("case_id", selectedCaseId)
            .maybeSingle(),
        ]);
        if (jobResult.error) throw jobResult.error;
        if (!cancelled) {
          setCommandStatus(String(command?.status ?? ""));
          if (jobResult.data) setJob(jobResult.data as JobRow);
        }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : String(error));
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, job?.id, job?.control_command_id, selectedCaseId]);

  useEffect(() => {
    if (!token || !selectedCaseId || !job?.id) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadPersistedInvestigationResults(
          integritasSupabase,
          selectedCaseId,
          job.id,
        );
        if (!cancelled) setResults(next);
      } catch (error) {
        if (!cancelled) {
          setResults(null);
          setNotice(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, selectedCaseId, job?.id]);

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setNotice("Sending secure sign-in link…");
    try {
      const { error } = await integritasSupabase.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: `${window.location.origin}/crm`,
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setNotice("Secure sign-in link sent. Open it on this device to continue.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await integritasSupabase.auth.signOut();
      setNotice("Signed out.");
    } finally {
      setBusy(false);
    }
  };

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !newCase.title.trim() || !newCase.purpose.trim() || !newCase.authorizedScope.trim()) return;
    setBusy(true);
    setNotice("Creating authorized case…");
    try {
      const caseId = await browserClient.createCase(token, newCase);
      if (!caseId) throw new Error("Case creation did not return an ID.");
      await refreshCases(token, caseId);
      setCreateOpen(false);
      setNewCase({
        title: "",
        purpose: "Authorized counterparty due-diligence and verification.",
        authorizedScope: "Review supplied evidence and conduct lawful public-source verification for due-diligence purposes.",
        intendedSubjects: "",
        jurisdictions: "South Africa",
      });
      setNotice("Case created. Upload evidence to begin.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const selectFiles = (nextFiles: File[]) => {
    try {
      validateCaseDocumentSelection(documents.length, nextFiles);
      const oversized = nextFiles.find((file) => file.size > 5 * 1024 * 1024);
      if (oversized) throw new Error(`${oversized.name} exceeds the current 5 MB per-file upload limit.`);
      setFiles(nextFiles);
      setNotice("");
    } catch (error) {
      setFiles([]);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const uploadSelected = async () => {
    if (!token || !selectedCase || files.length === 0) return;
    setBusy(true);
    setNotice("Uploading and hashing evidence…");
    try {
      await browserClient.uploadFiles(token, selectedCase.id, documents.length, files);
      await refreshSelectedCase();
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Evidence uploaded. The case revision has been refreshed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const startInvestigation = async () => {
    if (!token || !selectedCase || !startAllowed) return;
    setBusy(true);
    setNotice("Queueing durable Oracle/OpenClaw investigation…");
    try {
      const idempotencyKey = `crm:${selectedCase.id}:rev:${selectedCase.revision}:depth:${depth}`;
      const investigation = await browserClient.startInvestigation(token, {
        caseId: selectedCase.id,
        caseRevision: selectedCase.revision,
        depth,
        idempotencyKey,
      });
      setJob({
        id: investigation.case_job_id,
        case_id: selectedCase.id,
        case_revision: selectedCase.revision,
        control_command_id: investigation.control_command_id,
        stage: "queued",
        progress: 0,
        runtime_provider: "openclaw-oracle",
      });
      setCommandStatus("queued");
      setNotice("Investigation queued. You can safely close this page; execution continues server-side.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const cancelInvestigation = async () => {
    if (!token || !job || terminalStages.has(job.stage)) return;
    setBusy(true);
    setNotice("Requesting cancellation…");
    try {
      await browserClient.cancelInvestigation(token, job.id);
      await refreshSelectedCase();
      setNotice("Cancellation requested. The Oracle worker will stop at the next safe boundary.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const retryInvestigation = async () => {
    if (!token || !job) return;
    setBusy(true);
    setNotice("Requesting bounded retry…");
    try {
      const investigation = await browserClient.retryInvestigation(token, job.id);
      if (investigation?.control_command_id) {
        setJob((current) =>
          current
            ? {
                ...current,
                control_command_id: investigation.control_command_id,
                stage: investigation.stage ?? current.stage,
                progress: investigation.progress ?? current.progress,
              }
            : current,
        );
      }
      await refreshSelectedCase();
      setNotice("Retry queued. Verified staged work may be reused when provenance still matches.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const activeIndex = job ? stages.findIndex(([key]) => key === job.stage) : -1;
  const canCancel = Boolean(job && !terminalStages.has(job.stage) && ["queued", "leased", "running", ""].includes(commandStatus));
  const canRetry = Boolean(
    job &&
      (["failed", "incomplete", "research_limit_reached", "cancelled"].includes(job.stage) ||
        ["failed", "cancelled"].includes(commandStatus)),
  );

  if (!token) {
    return (
      <main className="min-h-screen bg-[#080808] text-[#F7F5F0]">
        <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
          <div className="w-full border border-[#D4AF37]/25 bg-[#101010] p-7 shadow-2xl md:p-10">
            <Link href="/" className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
              ← Integritas
            </Link>
            <p className="mt-10 text-[10px] uppercase tracking-[0.28em] text-[#D4AF37]">
              Private command center
            </p>
            <h1 className="mt-3 font-serif text-4xl font-normal">Authorized analyst sign-in</h1>
            <p className="mt-4 text-sm leading-7 text-[#A9A39A]">
              Access is enforced by Supabase Auth, the Integritas admin allowlist, case-level
              access mapping and row-level security. A valid existing analyst account is required.
            </p>
            <form onSubmit={sendMagicLink} className="mt-8 space-y-4">
              <label htmlFor="integritas-admin-email" className="block text-xs uppercase tracking-[0.14em] text-[#C5A46E]">
                Email address
              </label>
              <input
                id="integritas-admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 w-full border border-[#D4AF37]/25 bg-[#080808] px-4 text-sm outline-none transition focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="h-12 w-full bg-[#D4AF37] text-xs font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[#E5C07B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send secure sign-in link"}
              </button>
            </form>
            {notice && (
              <div className="mt-5 border border-[#D4AF37]/15 bg-[#D4AF37]/5 p-3 text-sm text-[#D8D0C2]" role="status">
                {notice}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] text-[#F7F5F0]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-[#D4AF37]/15 bg-[#0D0D0D] lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="sticky top-0 p-5 lg:p-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center border border-[#D4AF37]/40 font-serif text-lg text-[#D4AF37]">
                I
              </span>
              <span>
                <strong className="block font-serif text-lg font-normal">Integritas</strong>
                <small className="block text-[8px] uppercase tracking-[0.2em] text-[#C5A46E]">
                  Private Command Center
                </small>
              </span>
            </Link>
            <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1">
              {nav.map(([label, href, Icon]) => (
                <a
                  href={href}
                  key={label}
                  className="flex min-w-max items-center gap-2 px-3 py-2 text-xs text-[#A9A39A] transition hover:bg-[#D4AF37]/8 hover:text-[#D4AF37]"
                >
                  <Icon size={15} />
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-7 md:px-8 lg:px-10 lg:py-10">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#D4AF37]">
                Private AI investigation workspace
              </p>
              <h1 className="mt-2 font-serif text-3xl font-normal md:text-4xl">
                Due-diligence command center
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-2 border px-3 py-2 text-xs ${statusClass(runtimeReady)}`}>
                {runtimeReady ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {runtimeReady ? "Oracle/OpenClaw ready" : "Runtime preflight required"}
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={busy}
                className="flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-[#A9A39A] hover:text-white disabled:opacity-50"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </header>

          {notice && (
            <div className="mt-6 border border-[#D4AF37]/20 bg-[#D4AF37]/7 p-3 text-sm text-[#DED5C5]" role="status">
              {notice}
            </div>
          )}

          <section id="dashboard" className="mt-7 border border-[#D4AF37]/20 bg-gradient-to-br from-[#12110E] to-[#0D0D0D] p-5 md:p-7">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
              <div className="max-w-3xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#D4AF37]">
                  Durable AI workflow
                </p>
                <h2 className="mt-2 font-serif text-2xl md:text-3xl">
                  Upload evidence, launch OpenClaw, review source-linked results.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#9F978C]">
                  Supabase remains the authorization and evidence source of truth. Oracle executes
                  outbound-only jobs; the OpenClaw Gateway is never exposed to this browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen((value) => !value)}
                  className="flex items-center gap-2 border border-[#D4AF37]/35 px-4 py-3 text-xs uppercase tracking-[0.14em] text-[#D4AF37]"
                >
                  <Plus size={16} />
                  New case
                </button>
                <button
                  type="button"
                  disabled={!selectedCase || busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 border border-white/12 px-4 py-3 text-xs uppercase tracking-[0.14em] text-[#D8D0C2] disabled:opacity-40"
                >
                  <UploadCloud size={16} />
                  Add evidence
                </button>
                <button
                  type="button"
                  disabled={!startAllowed}
                  onClick={() => void startInvestigation()}
                  className="flex items-center gap-2 bg-[#D4AF37] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Play size={16} />
                  Start Deep Investigation
                </button>
              </div>
            </div>
          </section>

          {createOpen && (
            <form onSubmit={createCase} className="mt-5 grid gap-4 border border-[#D4AF37]/20 bg-[#101010] p-5 md:grid-cols-2 md:p-6">
              <div className="md:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#D4AF37]">New authorized case</p>
                <p className="mt-2 text-xs leading-5 text-[#938B7E]">
                  Create a case only where Integritas is authorized to perform the requested verification.
                </p>
              </div>
              <label className="grid gap-2 text-xs text-[#CFC6B7] md:col-span-2">
                Case title
                <input
                  value={newCase.title}
                  onChange={(event) => setNewCase((value) => ({ ...value, title: event.target.value }))}
                  maxLength={160}
                  required
                  className="h-11 border border-white/10 bg-[#080808] px-3 outline-none focus:border-[#D4AF37]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Purpose
                <textarea
                  value={newCase.purpose}
                  onChange={(event) => setNewCase((value) => ({ ...value, purpose: event.target.value }))}
                  maxLength={4000}
                  required
                  rows={4}
                  className="border border-white/10 bg-[#080808] p-3 outline-none focus:border-[#D4AF37]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Authorized scope
                <textarea
                  value={newCase.authorizedScope}
                  onChange={(event) => setNewCase((value) => ({ ...value, authorizedScope: event.target.value }))}
                  maxLength={4000}
                  required
                  rows={4}
                  className="border border-white/10 bg-[#080808] p-3 outline-none focus:border-[#D4AF37]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Intended subjects
                <input
                  value={newCase.intendedSubjects}
                  onChange={(event) => setNewCase((value) => ({ ...value, intendedSubjects: event.target.value }))}
                  maxLength={2000}
                  className="h-11 border border-white/10 bg-[#080808] px-3 outline-none focus:border-[#D4AF37]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Jurisdictions
                <input
                  value={newCase.jurisdictions}
                  onChange={(event) => setNewCase((value) => ({ ...value, jurisdictions: event.target.value }))}
                  placeholder="South Africa, United Kingdom"
                  className="h-11 border border-white/10 bg-[#080808] px-3 outline-none focus:border-[#D4AF37]"
                />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-[#D4AF37] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-50"
                >
                  Create authorized case
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="border border-white/10 px-5 py-3 text-xs uppercase tracking-[0.14em] text-[#AAA195]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <article id="cases" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-serif text-xl">Cases &amp; Evidence</h2>
                <span className="text-xs text-[#D4AF37]">{cases.length} cases</span>
              </div>
              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Active case
                <select
                  value={selectedCaseId}
                  disabled={cases.length === 0 || busy}
                  onChange={(event) => setSelectedCaseId(event.target.value)}
                  className="h-11 border border-white/10 bg-[#080808] px-3 outline-none focus:border-[#D4AF37]"
                >
                  {cases.length === 0 && <option value="">No assigned cases</option>}
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · rev {item.revision}
                    </option>
                  ))}
                </select>
              </label>

              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept={SUPPORTED_CASE_FILE_ACCEPT}
                multiple
                disabled={!selectedCase || busy}
                onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
              />

              <div className="mt-4 border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span>Documents</span>
                  <span className="text-[#D4AF37]">{documents.length}/20</span>
                </div>
                {documents.length > 0 && (
                  <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-[#AFA79B]">
                    {documents.map((document) => (
                      <li key={document.id} className="truncate">• {document.name}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] leading-5 text-[#7F786E]">
                  PDF, TXT, Markdown or CSV. Current API limit: 5 MB per file. SHA-256 deduplication and case revisioning are server-enforced.
                </p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 border border-[#D4AF37]/15 p-3">
                  <p className="text-xs text-[#D4AF37]">{files.length} file(s) selected</p>
                  <button
                    type="button"
                    onClick={() => void uploadSelected()}
                    disabled={busy}
                    className="mt-3 flex items-center gap-2 bg-[#D4AF37] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-50"
                  >
                    <UploadCloud size={15} />
                    Upload selected evidence
                  </button>
                </div>
              )}
            </article>

            <article id="investigation" className="border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-serif text-xl">OpenClaw Investigation</h2>
                <span className="text-xs text-[#D4AF37]">{job ? `${job.progress}%` : "Ready to queue"}</span>
              </div>

              <div className={`mb-4 border p-3 text-xs ${statusClass(runtimeReady)}`}>
                <div className="flex items-center gap-2">
                  {runtimeReady ? <Shield size={15} /> : <AlertTriangle size={15} />}
                  <strong>{runtime?.worker_id ?? "Oracle worker unavailable"}</strong>
                </div>
                <p className="mt-1 opacity-80">
                  Worker {runtime?.worker_version ?? "—"} · OpenClaw {runtime?.openclaw_status ?? "unknown"}
                </p>
              </div>

              <label className="grid gap-2 text-xs text-[#CFC6B7]">
                Investigation depth
                <select
                  value={depth}
                  disabled={busy}
                  onChange={(event) => setDepth(event.target.value as InvestigationDepth)}
                  className="h-11 border border-white/10 bg-[#080808] px-3 outline-none focus:border-[#D4AF37]"
                >
                  <option value="fast">Fast</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                  <option value="maximum">Maximum appropriate depth</option>
                </select>
              </label>

              {job ? (
                <>
                  <div className="mt-5 h-1.5 bg-white/8">
                    <div className="h-full bg-[#D4AF37]" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
                  </div>
                  <div className="mt-4 space-y-2">
                    {stages.map(([key, label], index) => {
                      const currentIndex = activeIndex < 0 ? stages.length : activeIndex;
                      const done = terminalStages.has(job.stage) || index < currentIndex;
                      const active = !terminalStages.has(job.stage) && index === currentIndex;
                      return (
                        <div key={key} className="flex items-center gap-3 text-xs">
                          <span className={`size-2 rounded-full ${done ? "bg-emerald-400" : active ? "bg-[#D4AF37]" : "bg-white/15"}`} />
                          <span className={active ? "text-[#F7F5F0]" : "text-[#8F8981]"}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 border-t border-white/8 pt-4">
                    <p className="text-xs text-[#A99F91]">
                      Stage: <strong className="text-[#E8DCC1]">{stageLabel(job.stage)}</strong>
                      {" · "}command: <strong className="text-[#E8DCC1]">{commandStatus || "queued"}</strong>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => void cancelInvestigation()}
                          disabled={busy}
                          className="flex items-center gap-2 border border-red-400/25 px-3 py-2 text-xs text-red-200 disabled:opacity-50"
                        >
                          <Square size={13} />
                          Cancel
                        </button>
                      )}
                      {canRetry && (
                        <button
                          type="button"
                          onClick={() => void retryInvestigation()}
                          disabled={busy}
                          className="flex items-center gap-2 border border-[#D4AF37]/30 px-3 py-2 text-xs text-[#D4AF37] disabled:opacity-50"
                        >
                          <RotateCcw size={13} />
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void refreshSelectedCase();
                          void refreshResults();
                        }}
                        className="flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-[#AFA79B]"
                      >
                        <RefreshCw size={13} />
                        Refresh
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-5 border border-dashed border-white/10 p-4 text-sm leading-6 text-[#8F8981]">
                  Select a case with evidence. The start button activates only when the Oracle/OpenClaw runtime is freshly attested.
                </div>
              )}

              {!startAllowed && selectedCase && !job && (
                <p className="mt-4 text-[11px] leading-5 text-[#867E72]">
                  Start requires at least one evidence document, an attested runtime and no existing current-revision job.
                </p>
              )}
            </article>

            {results && selectedCase && job ? (
              <ResultSections
                results={results}
                selectedCase={selectedCase}
                job={job}
                token={token}
                onRefresh={refreshResults}
                setNotice={setNotice}
              />
            ) : (
              <article id="entities" className="xl:col-span-2 border border-[#D4AF37]/15 bg-[#111111] p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <FileSearch className="text-[#D4AF37]" size={20} />
                  <div>
                    <h2 className="font-serif text-xl">Persisted investigation results</h2>
                    <p className="mt-1 text-sm text-[#8F8981]">
                      Entities, source-linked findings, checks and the draft report appear here after the bounded worker commits a validated bundle.
                    </p>
                  </div>
                </div>
              </article>
            )}

            <article className="xl:col-span-2 border border-[#D4AF37]/15 bg-[#0E0E0E] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 shrink-0 text-[#D4AF37]" size={18} />
                <div>
                  <h2 className="font-serif text-lg">Control boundary</h2>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-[#8F8981]">
                    <li>• Browser access is authenticated with Supabase and restricted by case-level RLS.</li>
                    <li>• Evidence is stored privately; short-lived signed URLs are created only for the authorized Oracle worker.</li>
                    <li>• The OpenClaw Gateway remains loopback-only. This page never receives provider credentials, worker tokens or shell access.</li>
                    <li>• Model output must pass deterministic schema and quality validation before atomic persistence.</li>
                    <li>• Reports remain draft/review/finalize gated and stale automatically when new evidence changes the case revision.</li>
                  </ul>
                </div>
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
