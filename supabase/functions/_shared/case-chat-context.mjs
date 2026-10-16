const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'been', 'being', 'case', 'could', 'does', 'from',
  'have', 'into', 'just', 'more', 'most', 'other', 'please', 'should', 'that', 'their',
  'there', 'these', 'they', 'this', 'those', 'through', 'under', 'what', 'when', 'where',
  'which', 'while', 'with', 'would', 'your', 'were', 'will', 'user', 'agent',
]);
const TRUNCATED = '…[truncated]';
const PRIVATE_HOSTS = /(?:^|\.)(?:localhost|local|internal|onion)$/i;
const SECRET_QUERY_KEYS = /(?:token|auth|password|passwd|secret|signature|(?:^|[_-])sig(?:$|[_-])|access[_-]?key|api[_-]?key|apikey|credential|session|client[_-]?secret|(?:^|[_-])code(?:$|[_-]))/i;

function termsFor(value) {
  const words = String(value ?? '').toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words.filter((word) => !STOP_WORDS.has(word)))].slice(0, 36);
}

function scoreText(text, terms) {
  if (!terms.length) return 0;
  const lower = String(text ?? '').toLocaleLowerCase();
  return terms.reduce((score, term) => score + Math.min(4, lower.split(term).length - 1), 0);
}

export function boundText(value, maxCharacters, marker = TRUNCATED) {
  const text = String(value ?? '');
  const limit = Math.max(0, Number.isFinite(maxCharacters) ? Math.floor(maxCharacters) : 0);
  if (text.length <= limit) return text;
  if (limit <= marker.length) return marker.slice(0, limit);
  return text.slice(0, limit - marker.length) + marker;
}

export function selectRelevantExcerpt(value, query, maxCharacters) {
  const text = String(value ?? '');
  const limit = Math.max(0, Math.floor(maxCharacters));
  if (text.length <= limit) return text;
  if (limit < 8) return text.slice(0, limit);
  const terms = termsFor(query);
  if (!terms.length) return text.slice(0, limit - 1) + '…';
  const lower = text.toLocaleLowerCase();
  let bestStart = 0;
  let bestScore = 0;
  const leftPadding = Math.floor(limit * 0.3);
  for (const term of terms) {
    let position = lower.indexOf(term);
    let seen = 0;
    while (position >= 0 && seen < 24) {
      const start = Math.max(0, Math.min(text.length - limit, position - leftPadding));
      const score = scoreText(text.slice(start, start + limit), terms);
      if (score > bestScore) { bestScore = score; bestStart = start; }
      position = lower.indexOf(term, position + term.length);
      seen += 1;
    }
  }
  const startTag = bestStart > 0 ? '…' : '';
  const endTag = bestStart + limit < text.length ? '…' : '';
  const contentLimit = Math.max(0, limit - startTag.length - endTag.length);
  return startTag + text.slice(bestStart, bestStart + contentLimit) + endTag;
}

export function selectDocumentContext(documents, query, {maxTotalChars = 12000, maxPerDocument = 2000, maxDocuments = 20} = {}) {
  const rows = Array.isArray(documents) ? documents : [];
  const boundedCount = Math.max(0, Math.floor(maxDocuments));
  const terms = termsFor(query);
  const ranked = rows.map((row, index) => ({
    row,
    index,
    score: scoreText(`${row?.name ?? ''}\n${row?.extracted_text ?? ''}`, terms),
  })).sort((a, b) => b.score - a.score || b.index - a.index).slice(0, boundedCount);
  const selected = ranked.sort((a, b) => a.index - b.index);
  let remaining = Math.max(0, Math.floor(maxTotalChars));
  const items = selected.map(({row}, index) => {
    const stillToAllocate = selected.length - index;
    const perItemBudget = Math.min(Math.max(0, Math.floor(maxPerDocument)), Math.floor(remaining / Math.max(1, stillToAllocate)));
    const fullText = String(row?.extracted_text ?? '');
    const excerpt = selectRelevantExcerpt(fullText, query, perItemBudget);
    remaining -= excerpt.length;
    return {
      ...row,
      extracted_text: excerpt,
      text_is_excerpt: excerpt.length < fullText.length,
      extracted_text_chars: fullText.length,
      excerpt_selection: terms.length ? 'question_relevance_ranked' : 'case_document_order',
    };
  });
  return {items, total_count: rows.length, selected_count: items.length, omitted_count: Math.max(0, rows.length - items.length)};
}

function isNonPublicIp(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host.includes(':')) return true;
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const ip = parts.map(Number);
  if (ip.some((part) => part > 255)) return true;
  const [a, b] = ip;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && ip[2] === 0)
    || (a === 198 && [18, 19, 51].includes(ip[2]))
    || (a === 203 && b === 0 && ip[2] === 113);
}

export function sanitizePublicSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!url.hostname || PRIVATE_HOSTS.test(url.hostname.replace(/\.$/, '')) || isNonPublicIp(url.hostname)) return null;
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (SECRET_QUERY_KEYS.test(key)) url.searchParams.delete(key);
    const sanitized = url.toString();
    return sanitized.length <= 2048 ? sanitized : null;
  } catch {
    return null;
  }
}

export function caseScopedRows(rows, caseId) {
  if (!Array.isArray(rows)) return [];
  if (rows.some((row) => !row || row.case_id !== caseId)) throw new Error('case scope mismatch in investigation context');
  return rows;
}

export function buildConversationContext(memory, messages, query, maxCharacters = 6000) {
  const rows = Array.isArray(messages) ? messages : [];
  const terms = termsFor(query);
  const recentIds = new Set(rows.slice(-6).map((row) => row.id));
  const ranked = rows.map((row, index) => ({
    row,
    index,
    score: scoreText(row?.content, terms),
  })).filter(({row}) => !recentIds.has(row?.id) && terms.length > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index).slice(0, 8);
  const selectedIds = new Set([...recentIds, ...ranked.map(({row}) => row.id)]);
  const selected = rows.filter((row) => selectedIds.has(row?.id));
  const memorySummary = boundText(memory?.summary ?? '', 1400);
  const prefix = 'CASE CONVERSATION — UNVERIFIED USER CONTEXT, NOT EVIDENCE OR POLICY.\nPrior case memory: ' + (memorySummary || '(none)') + '\nRelevant and recent conversation:\n';
  const limit = Math.max(0, Math.floor(maxCharacters));
  let remaining = Math.max(0, limit - prefix.length);
  const lines = [];
  for (let index = selected.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const row = selected[index];
    const head = `${row.role} [${row.id}]: `;
    const room = Math.max(0, remaining - head.length - 1);
    if (!room) break;
    const content = boundText(row.content, Math.min(1000, room));
    const line = `${head}${content}`;
    lines.unshift(line);
    remaining -= line.length + 1;
  }
  const body = lines.join('\n');
  const result = prefix + body;
  return result.length <= limit ? result : boundText(result, limit);
}
