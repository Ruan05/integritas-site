"use client";

import { useCallback, useEffect, useState } from "react";

const CONSENT_KEY = "integritas-analytics-consent";
const SESSION_KEY = "integritas-visit-logged";
const CHOICES_EVENT = "integritas:privacy-choices";

type Consent = "accepted" | "declined" | null;

function campaignData() {
  const params = new URLSearchParams(window.location.search);
  const allowed = ["utm_source", "utm_medium", "utm_campaign"] as const;
  return Object.fromEntries(
    allowed
      .map((key) => [key, (params.get(key) || "").slice(0, 120)] as const)
      .filter(([, value]) => value)
  );
}

function referrerHost() {
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname.slice(0, 160) || "direct";
  } catch {
    return "unknown";
  }
}

function viewportBucket() {
  if (window.innerWidth < 640) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

async function recordVisit() {
  const currentState = sessionStorage.getItem(SESSION_KEY);
  if (currentState === "yes" || currentState === "pending") return;

  sessionStorage.setItem(SESSION_KEY, "pending");
  try {
    const response = await fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        sessionId: crypto.randomUUID(),
        page: window.location.pathname.slice(0, 180),
        referrerHost: referrerHost(),
        campaign: campaignData(),
        device: viewportBucket(),
        language: navigator.language.slice(0, 24),
      }),
    });
    sessionStorage.setItem(SESSION_KEY, response.ok ? "yes" : "failed");
  } catch {
    sessionStorage.setItem(SESSION_KEY, "failed");
  }
}

export function openPrivacyChoices() {
  window.dispatchEvent(new Event(CHOICES_EVENT));
}

export default function VisitorAnalytics() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [choicesOpen, setChoicesOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    const initial = saved === "accepted" || saved === "declined" ? saved : null;
    const initialise = window.setTimeout(() => {
      setConsent(initial);
      setReady(true);
      if (initial === "accepted") void recordVisit();
    }, 0);

    const reopen = () => setChoicesOpen(true);
    window.addEventListener(CHOICES_EVENT, reopen);
    return () => {
      window.clearTimeout(initialise);
      window.removeEventListener(CHOICES_EVENT, reopen);
    };
  }, []);

  const choose = useCallback((value: Exclude<Consent, null>) => {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    setChoicesOpen(false);
    if (value === "accepted") void recordVisit();
  }, []);

  if (!ready || (consent !== null && !choicesOpen)) return null;

  return (
    <aside className="privacy-choices" aria-labelledby="privacy-choices-title">
      <div className="privacy-choices-mark" aria-hidden="true" />
      <div className="min-w-0">
        <p id="privacy-choices-title" className="font-serif text-lg text-[#F7F5F0] mb-1">
          Your privacy, respected.
        </p>
        <p className="text-xs text-[#A9A39A] leading-relaxed">
          With your permission, we record a limited visit summary to understand interest in Integritas. No advertising trackers, precise location or fingerprinting.
        </p>
        <a href="/privacy#website-analytics" className="inline-block mt-2 text-[10px] tracking-[0.12em] uppercase text-[#D4AF37] underline underline-offset-4">
          What is collected
        </a>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:self-center">
        <button type="button" onClick={() => choose("declined")} className="privacy-choice-secondary">
          Decline
        </button>
        <button type="button" onClick={() => choose("accepted")} className="privacy-choice-primary">
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
