"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function CrmPasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/crm/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Access denied.");
        return;
      }
      window.location.replace("/crm");
    } catch {
      setError("Unable to verify access. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 py-10 text-[#F7F5F0]">
      <section className="w-full max-w-md border border-[#D4AF37]/25 bg-[#101010] p-7 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center border border-[#D4AF37]/35 text-[#D4AF37]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-serif text-xl leading-none">Integritas</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-[#C5A46E]">Private investigations</p>
          </div>
        </div>

        <p className="text-[10px] uppercase tracking-[0.24em] text-[#D4AF37]">Private access</p>
        <h1 className="mt-3 font-serif text-3xl font-normal sm:text-4xl">Enter password</h1>
        <p className="mt-4 text-sm leading-6 text-[#9F9991]">
          Enter the Integritas access password to open the investigation workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="crm-entry-password" className="sr-only">Password</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#D4AF37]/70" aria-hidden="true" />
              <input
                id="crm-entry-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
                maxLength={128}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "crm-entry-error" : undefined}
                className="h-12 w-full border border-[#D4AF37]/25 bg-[#090909] pl-10 pr-4 text-sm text-[#F7F5F0] outline-none transition focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20"
                placeholder="Password"
              />
            </div>
            {error ? (
              <p id="crm-entry-error" role="alert" className="mt-2 text-xs text-red-300">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full bg-[#D4AF37] px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#080808] transition hover:bg-[#E4C45F] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Opening…" : "Open workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}
