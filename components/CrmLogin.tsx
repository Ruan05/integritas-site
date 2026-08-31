"use client";

import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CrmLogin() {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        return;
      }
      window.location.assign("/crm");
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 border border-[#D4AF37]/30 px-2.5 text-[9px] uppercase tracking-[0.16em] text-[#C5A46E] transition-colors hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 hover:text-[#E5C07B]"
          aria-label="Open CRM login"
        >
          <LogIn aria-hidden="true" className="size-3" />
          <span>Login</span>
        </button>
      </DialogTrigger>
      <DialogContent className="border-[#D4AF37]/30 bg-[#111111] text-[#F7F5F0] shadow-2xl sm:max-w-sm">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#D4AF37]">Private access</p>
          <DialogTitle className="font-serif text-2xl font-normal">Integritas CRM</DialogTitle>
          <DialogDescription className="text-[#A9A39A]">
            Enter the dashboard password to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div>
            <label htmlFor="crm-password" className="sr-only">Password</label>
            <Input
              id="crm-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "crm-login-error" : undefined}
              className="h-11 border-[#D4AF37]/25 bg-[#0A0A0A] text-[#F7F5F0] placeholder:text-[#77716A] focus-visible:border-[#D4AF37] focus-visible:ring-[#D4AF37]/20"
            />
            {error && <p id="crm-login-error" role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-none bg-[#D4AF37] text-[#0A0A0A] hover:bg-[#E5C07B]"
          >
            {submitting ? "Checking…" : "Open dashboard"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
