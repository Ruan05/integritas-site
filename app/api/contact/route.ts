import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 10 * 60_000;
const RATE_LIMIT_MAX = 4;
const MAX_BODY_BYTES = 20_000;

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[<>]/g, "").trim().slice(0, maxLength)
    : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildMailto(fields: {
  name: string;
  email: string;
  phone: string;
  enquiryType: string;
  message: string;
}) {
  const subject = encodeURIComponent(`Integritas enquiry: ${fields.enquiryType}`);
  const body = encodeURIComponent(
    [
      `Name: ${fields.name}`,
      `Email: ${fields.email}`,
      fields.phone ? `Phone: ${fields.phone}` : "",
      `Enquiry type: ${fields.enquiryType}`,
      "",
      "Message:",
      fields.message,
    ].filter(Boolean).join("\n")
  );
  return `mailto:info@integritass.com?subject=${subject}&body=${body}`;
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "The enquiry is too large." }, { status: 413 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many enquiries were submitted. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (clean(payload.website, 200)) {
    return NextResponse.json({ success: true, mode: "sent" });
  }

  const fields = {
    name: clean(payload.name, 120),
    email: clean(payload.email, 254).toLowerCase(),
    phone: clean(payload.phone, 40),
    enquiryType: clean(payload.enquiryType, 120),
    message: clean(payload.message, 5000),
  };

  if (fields.name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!isValidEmail(fields.email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!fields.enquiryType) {
    return NextResponse.json({ error: "Please select an enquiry type." }, { status: 400 });
  }
  if (payload.privacyAccepted !== true) {
    return NextResponse.json({ error: "Please confirm that we may use your details to respond." }, { status: 400 });
  }
  if (fields.message.length < 10) {
    return NextResponse.json({ error: "Please provide a little more detail about your enquiry." }, { status: 400 });
  }

  const mailtoLink = buildMailto(fields);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL || "info@integritass.com";

  if (!apiKey || !from) {
    return NextResponse.json({ success: true, mode: "mailto", mailtoLink });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: fields.email,
        subject: `Integritas enquiry: ${fields.enquiryType}`,
        text: [
          `Name: ${fields.name}`,
          `Email: ${fields.email}`,
          fields.phone ? `Phone: ${fields.phone}` : "",
          `Enquiry type: ${fields.enquiryType}`,
          "",
          fields.message,
        ].filter(Boolean).join("\n"),
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, mode: "sent" });
    }
  } catch {
    // Fall through to the honest mailto fallback. No personal data is logged.
  }

  return NextResponse.json({ success: true, mode: "mailto", mailtoLink });
}
