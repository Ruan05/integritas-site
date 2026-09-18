import { createClient } from "@supabase/supabase-js";

export const integritasSupabaseUrl = "https://leuixjgmlueptefintgo.supabase.co";
export const integritasSupabasePublishableKey = "sb_publishable_SMrqk1H95oGcGjSEtD3W9w_n6RVAl0I";

export const integritasSupabase = createClient(
  integritasSupabaseUrl,
  integritasSupabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "integritas-admin-auth",
    },
    global: {
      headers: {
        "x-client-info": "integritas-business-crm/1.0",
      },
    },
  },
);
