import {createIntakeBrowserClient} from './intake-browser';

export const crmIntakeClient = createIntakeBrowserClient(async (_token, body) => {
  const response = await fetch('/api/crm/backend', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), cache:'no-store'});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(String(payload.error || 'Submission request failed.')), {status:response.status, code:payload.code});
  return payload;
}, (...args) => fetch(...args), 'https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api');
