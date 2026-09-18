import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { crmSessionCookie, isValidCrmSession } from "@/lib/crm-auth";

export const dynamic = "force-dynamic";

const ADMIN_API = "https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api";
const CONTROL_API = "https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-control";
const CONTROL_ACTIONS = new Set([
  "runtime_status",
  "command_status",
  "start_case_investigation",
  "retry_case_investigation",
  "cancel_case_investigation",
]);

async function authorized() {
  const store = await cookies();
  return isValidCrmSession(store.get(crmSessionCookie.name)?.value);
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

export async function POST(request: Request) {
  if (!(await authorized())) return noStore({ error: "Session expired. Enter the CRM password again." }, 401);

  const backendToken = process.env.INTEGRITAS_CRM_BACKEND_TOKEN;
  if (!backendToken) return noStore({ error: "The investigation service is not configured." }, 503);

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (String(form.get("action") || "") !== "upload") {
        return noStore({ error: "Unsupported upload request." }, 400);
      }
      const response = await fetch(ADMIN_API, {
        method: "POST",
        headers: { "x-integritas-crm-token": backendToken },
        body: form,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      return noStore(payload, response.status);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    if (!action) return noStore({ error: "Action is required." }, 400);

    const target = CONTROL_ACTIONS.has(action) ? CONTROL_API : ADMIN_API;
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integritas-crm-token": backendToken,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    return noStore(payload, response.status);
  } catch {
    return noStore({ error: "The investigation service could not complete this request." }, 502);
  }
}
