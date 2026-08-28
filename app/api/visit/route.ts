import { getDb } from "@/db";
import { websiteVisits } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

type VisitPayload = {
  sessionId?: unknown;
  page?: unknown;
  referrerHost?: unknown;
  campaign?: unknown;
  device?: unknown;
  language?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[<>\r\n]/g, "").trim().slice(0, maxLength)
    : "";
}

function campaign(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { utm_source: "", utm_medium: "", utm_campaign: "" };
  }
  const input = value as Record<string, unknown>;
  return {
    utm_source: text(input.utm_source, 120),
    utm_medium: text(input.utm_medium, 120),
    utm_campaign: text(input.utm_campaign, 120),
  };
}

function browserFamily(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/CriOS|Chrome\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Other";
}

async function notifyVisit(entry: Record<string, string>) {
  if (process.env.VISITOR_NOTIFICATIONS_ENABLED !== "true") return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.VISITOR_NOTIFICATION_EMAIL || process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !from || !to) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New Integritas website visit — ${entry.device}`,
      text: [
        "A visitor consented to limited first-party analytics.",
        "",
        `Time: ${entry.timestamp}`,
        `Page: ${entry.page}`,
        `Source: ${entry.referrerHost}`,
        `Campaign source: ${entry.utmSource || "None"}`,
        `Campaign medium: ${entry.utmMedium || "None"}`,
        `Campaign name: ${entry.utmCampaign || "None"}`,
        `Device: ${entry.device}`,
        `Browser: ${entry.browser}`,
        `Language: ${entry.language}`,
        `Country: ${entry.country || "Not supplied by host"}`,
        `Session: ${entry.sessionId}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) throw new Error("Visitor notification failed");
}

export async function POST(req: NextRequest) {
  let payload: VisitPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const sessionId = text(payload.sessionId, 64);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const campaignTags = campaign(payload.campaign);
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId,
    page: text(payload.page, 180) || "/",
    referrerHost: text(payload.referrerHost, 160) || "direct",
    utmSource: campaignTags.utm_source,
    utmMedium: campaignTags.utm_medium,
    utmCampaign: campaignTags.utm_campaign,
    device: text(payload.device, 20) || "unknown",
    browser: browserFamily(req.headers.get("user-agent") || ""),
    language: text(payload.language, 24) || "unknown",
    country:
      text(req.headers.get("cf-ipcountry"), 3) ||
      text(req.headers.get("x-vercel-ip-country"), 3),
    consent: "analytics",
  };

  try {
    await getDb()
      .insert(websiteVisits)
      .values({
        sessionId: entry.sessionId,
        page: entry.page,
        referrerHost: entry.referrerHost,
        utmSource: entry.utmSource,
        utmMedium: entry.utmMedium,
        utmCampaign: entry.utmCampaign,
        device: entry.device,
        browser: entry.browser,
        language: entry.language,
        country: entry.country,
        consent: entry.consent,
      })
      .onConflictDoNothing({ target: websiteVisits.sessionId });
  } catch {
    return NextResponse.json({ error: "Analytics storage unavailable" }, { status: 503 });
  }

  try {
    await notifyVisit(entry);
  } catch {
    // The durable visit record remains valid if an optional email notification fails.
  }

  return new NextResponse(null, { status: 204 });
}
