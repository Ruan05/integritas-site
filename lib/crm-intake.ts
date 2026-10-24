import {createIntakeBrowserClient} from './intake-browser';

export const crmIntakeClient = createIntakeBrowserClient(async (_token, body) => {
  const response = await fetch('/api/crm/backend', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), cache:'no-store'});
  // SQL returns JSON null when the case has no submission. Preserve that domain value.
  const payload:unknown = await response.json().catch(()=>undefined);
  const errorBody=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
  if (!response.ok) throw Object.assign(new Error(String(errorBody.error || 'Submission request failed.')), {status:response.status, code:errorBody.code});
  return payload;
}, (...args) => fetch(...args), 'https://leuixjgmlueptefintgo.supabase.co/functions/v1/integritas-admin-api');
