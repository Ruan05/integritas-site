const encoder = new TextEncoder();

type ReportContext = {
  documents?: unknown[];
  sources?: Array<{ id?: string | null; source_key?: string | null; title?: string | null; evidence_origin?: string | null; source_type?: string | null; verification_state?: string | null }>;
  findings?: unknown[];
  checks?: Array<{ status?: string | null }>;
  entities?: Array<{ id?: string | null; display_name?: string | null; entity_type?: string | null; match_status?: string | null; match_confidence?: number | null }>;
  relationships?: Array<{ from_entity_id?: string | null; to_entity_id?: string | null; source_id?: string | null; claim?: string | null; relationship_type?: string | null; evidence_status?: string | null }>;
  reportStatus?: string | null;
};

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; rows: string[] };

type PdfPage = { commands: string[]; cursor: number; dark: boolean };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const BODY_W = PAGE_W - MARGIN * 2;
const colors = {
  black: [0.035, 0.035, 0.035],
  ink: [0.075, 0.07, 0.06],
  gold: [0.725, 0.59, 0.275],
  parchment: [0.965, 0.945, 0.91],
  muted: [0.4, 0.375, 0.34],
  panel: [0.91, 0.875, 0.805],
  white: [0.97, 0.95, 0.91],
};

function ascii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function rgb(color: number[]) { return color.map((value) => value.toFixed(3)).join(" "); }
function y(top: number) { return PAGE_H - top; }

function rect(page: PdfPage, left: number, top: number, width: number, height: number, color: number[]) {
  page.commands.push(`q ${rgb(color)} rg ${left} ${(PAGE_H - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`);
}

function rule(page: PdfPage, left: number, top: number, width: number, height: number, color: number[]) {
  rect(page, left, top, width, height, color);
}

function text(page: PdfPage, value: string, left: number, top: number, size: number, font: "F1" | "F2" | "F3" | "F4", color: number[], letterSpacing = 0) {
  page.commands.push(`q ${rgb(color)} rg BT /${font} ${size.toFixed(2)} Tf ${letterSpacing.toFixed(2)} Tc 1 0 0 1 ${left.toFixed(2)} ${y(top).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET Q`);
}

function wrap(value: string, size: number, width = BODY_W) {
  const max = Math.max(20, Math.floor(width / Math.max(1, size * 0.5)));
  const words = ascii(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function clean(value: string) {
  return value
    .replace(/\\\\n/g, "\n")
    .replace(/\\\\r/g, "\n")
    .replace(/\\\\t/g, " ")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryForDisplay(value: string) {
  const text = String(value ?? '').replace(/^# MASTER SUMMARY — READ THIS FIRST\s*/i, '').trim();
  const nextSection = text.search(/\n#{1,2}\s+/);
  return clean((nextSection >= 0 ? text.slice(0, nextSection) : text).slice(0, 3600));
}

function isDivider(line: string) { return /^\s*\|?\s*:?-{2,}/.test(line); }
function tableRow(line: string) { return line.split("|").map((cell) => clean(cell)).filter(Boolean).join("  -  "); }

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    const value = clean(paragraph.join(" "));
    if (value) blocks.push({ type: "paragraph", text: value });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) { flush(); blocks.push({ type: "heading", text: clean(heading[1]) }); continue; }
    if (line.startsWith("|") && line.includes("|")) {
      flush();
      const rows: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const candidate = lines[index].trim();
        if (!isDivider(candidate)) {
          const row = tableRow(candidate);
          if (row) rows.push(row);
        }
        index += 1;
      }
      index -= 1;
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }
    const bullet = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (bullet) { flush(); blocks.push({ type: "bullet", text: clean(bullet[1]) }); continue; }
    paragraph.push(line);
  }
  flush();
  return blocks.length ? blocks : [{ type: "paragraph", text: "No narrative report content was supplied." }];
}

function standardPage(): PdfPage {
  const page: PdfPage = { commands: [], cursor: 80, dark: false };
  rect(page, 0, 0, PAGE_W, PAGE_H, colors.parchment);
  text(page, "Integritas", MARGIN, 41, 17, "F3", colors.ink);
  text(page, "DUE DILIGENCE REPORT", 387, 42, 7.5, "F2", colors.muted, 1.05);
  rule(page, MARGIN, 55, BODY_W, 1.2, colors.gold);
  return page;
}

function footer(page: PdfPage, index: number, total: number) {
  rule(page, MARGIN, 748, BODY_W, 0.6, [0.78, 0.72, 0.62]);
  text(page, `CONFIDENTIAL  /  INTEGRITAS  /  ${index} OF ${total}`, 174, 767, 7.2, "F1", colors.muted, 0.65);
}

function ensure(pages: PdfPage[], height: number) {
  let page = pages[pages.length - 1];
  if (page.cursor + height > 735) { page = standardPage(); pages.push(page); }
  return page;
}

function paragraph(pages: PdfPage[], value: string, options: { bullet?: boolean; panel?: boolean } = {}) {
  const size = options.bullet ? 9.5 : 10;
  const indent = options.bullet ? 13 : 0;
  const lines = wrap(value, size, BODY_W - indent - (options.panel ? 18 : 0));
  let offset = 0;
  while (offset < lines.length) {
    let page = pages[pages.length - 1];
    if (page.cursor > 710) { page = standardPage(); pages.push(page); }
    const lineHeight = size * 1.55;
    const available = Math.max(1, Math.floor((730 - page.cursor - (options.panel ? 20 : 8)) / lineHeight));
    const chunk = lines.slice(offset, offset + available);
    const height = chunk.length * lineHeight + 8;
    if (options.panel) rect(page, MARGIN, page.cursor - 4, BODY_W, height + 8, colors.panel);
    chunk.forEach((line, index) => text(page, `${options.bullet && offset + index === 0 ? "-  " : ""}${line}`, MARGIN + indent + (options.panel ? 9 : 0), page.cursor + index * lineHeight, size, "F1", colors.ink));
    page.cursor += height + (options.panel ? 8 : 0);
    offset += chunk.length;
  }
}

function heading(pages: PdfPage[], value: string) {
  const page = ensure(pages, 34);
  text(page, clean(value).toUpperCase(), MARGIN, page.cursor, 14, "F4", [0.41, 0.31, 0.11], 0.2);
  rule(page, MARGIN, page.cursor + 19, 38, 1.3, colors.gold);
  page.cursor += 31;
}

function evidencePanel(pages: PdfPage[], context: ReportContext) {
  const docs = context.documents?.length || 0;
  const sources = context.sources?.length || 0;
  const findings = context.findings?.length || 0;
  const checks = context.checks?.length || 0;
  const complete = (context.checks || []).filter((item) => item?.status === "complete").length;
  const external = (context.sources || []).filter((item) => item?.evidence_origin === "external_research").length;
  const coverage = checks ? Math.round((complete / checks) * 100) : 0;
  const page = ensure(pages, 129);
  rect(page, MARGIN, page.cursor, BODY_W, 117, colors.panel);
  text(page, "EVIDENCE SNAPSHOT", MARGIN + 12, page.cursor + 17, 8, "F2", [0.42, 0.32, 0.13], 1.2);
  const stats = [[docs, "DOCUMENTS"], [sources, "SOURCES"], [findings, "FINDINGS"], [checks, "CHECKS"]] as const;
  stats.forEach(([value, label], index) => {
    const x = MARGIN + 12 + index * 124;
    rect(page, x, page.cursor + 31, 112, 43, colors.parchment);
    text(page, String(value), x + 9, page.cursor + 53, 18, "F3", colors.ink);
    text(page, label, x + 9, page.cursor + 68, 6.7, "F2", colors.muted, 0.75);
  });
  text(page, `CHECK COMPLETION  ${complete}/${checks}    /    EXTERNAL RESEARCH SOURCES  ${external}`, MARGIN + 12, page.cursor + 92, 7.1, "F2", colors.muted, 0.4);
  rect(page, MARGIN + 12, page.cursor + 101, BODY_W - 24, 5, [0.79, 0.75, 0.67]);
  rect(page, MARGIN + 12, page.cursor + 101, (BODY_W - 24) * (coverage / 100), 5, colors.gold);
  page.cursor += 137;
}

function statusCounts(values: unknown[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function qualityDashboard(pages: PdfPage[], context: ReportContext) {
  const findings = context.findings || [];
  const sources = context.sources || [];
  const checks = context.checks || [];
  const sourceExternal = sources.filter((source) => source?.evidence_origin === "external_research").length;
  const validatedExternal = sources.filter((source) => source?.evidence_origin === "external_research" && ["validated", "claim_supporting"].includes(source?.verification_state || "")).length;
  const uncertain = statusCounts(findings.map((item) => typeof item === "object" && item !== null ? (item as { evidence_status?: string }).evidence_status : "unknown"));
  const complete = checks.filter((item) => item?.status === "complete").length;
  const page = ensure(pages, 142);
  rect(page, MARGIN, page.cursor, BODY_W, 130, colors.panel);
  text(page, "QUALITY AND CLOSURE DASHBOARD", MARGIN + 12, page.cursor + 17, 8, "F2", [0.42, 0.32, 0.13], 1.1);
  const cards = [
    [`${validatedExternal}/${sourceExternal}`, "VALIDATED EXTERNAL"],
    [`${complete}/${checks.length || 0}`, "CHECKS COMPLETE"],
    [`${uncertain.find(([key]) => key === "uncertain")?.[1] || 0}`, "UNCERTAIN FINDINGS"],
    [`${context.reportStatus || "UNSPECIFIED"}`.toUpperCase(), "REPORT STATUS"],
  ];
  cards.forEach(([value, label], index) => {
    const x = MARGIN + 12 + index * 124;
    rect(page, x, page.cursor + 31, 112, 43, colors.parchment);
    text(page, value.slice(0, 18), x + 8, page.cursor + 53, value.length > 10 ? 9 : 17, "F2", colors.ink);
    text(page, label, x + 8, page.cursor + 68, 6.3, "F2", colors.muted, 0.55);
  });
  text(page, "Interpretation: opened sources are not validated sources; unresolved gates remain open until claim-level evidence is promoted.", MARGIN + 12, page.cursor + 94, 7.4, "F1", colors.ink);
  text(page, "Findings by evidence status:", MARGIN + 12, page.cursor + 111, 7.2, "F2", colors.muted);
  uncertain.slice(0, 6).forEach(([key, value], index) => text(page, `${key}: ${value}`, MARGIN + 112 + index * 78, page.cursor + 111, 6.8, "F1", colors.ink));
  page.cursor += 150;
}

function relationshipMap(pages: PdfPage[], context: ReportContext) {
  const relationships = context.relationships || [];
  heading(pages, "Evidence relationship register");
  paragraph(pages, "Each row records a persisted relationship and its evidence status. A submitted assertion is not proof of ownership, authority, common control or transaction performance.");
  if (!relationships.length) {
    paragraph(pages, "No relationship rows were persisted for this investigation.", { panel: true });
    return;
  }
  const entities = new Map((context.entities || []).map((item) => [item.id, item.display_name]));
  const sources = new Map((context.sources || []).map((item) => [item.id, item.source_key || item.title]));
  relationships.forEach((item) => {
    const from = entities.get(item.from_entity_id) || "Unresolved source entity";
    const to = entities.get(item.to_entity_id) || "Unresolved target entity";
    const source = sources.get(item.source_id) || "No linked source";
    paragraph(pages, `${from} -> ${to}; ${item.relationship_type || "relationship"}; ${String(item.evidence_status || "unknown").toUpperCase()}; Source: ${source}. ${item.claim || "No claim text recorded."}`, { panel: item.evidence_status !== "verified" });
  });
}

function closureRegister(pages: PdfPage[], context: ReportContext) {
  heading(pages, "Closure register");
  const checks = context.checks || [];
  if (!checks.length) {
    paragraph(pages, "No check records were supplied to the PDF renderer. The absence of check rows is treated as an unresolved reporting limitation.", { panel: true });
    return;
  }
  checks.forEach((check) => {
    const status = String(check.status || "unknown").toUpperCase();
    paragraph(pages, `${status} - ${String((check as { description?: string }).description || (check as { check_key?: string }).check_key || "Unnamed check")}`, { panel: status !== "COMPLETE" });
  });
}

function cover(title: string, summary: string, generatedAt: string, context: ReportContext): PdfPage {
  const page: PdfPage = { commands: [], cursor: 0, dark: true };
  rect(page, 0, 0, PAGE_W, PAGE_H, colors.black);
  text(page, "PRIVATE INVESTIGATION WORKSPACE", MARGIN, 58, 8.5, "F2", [0.79, 0.67, 0.4], 1.9);
  text(page, "Integritas", MARGIN, 120, 40, "F3", colors.white);
  text(page, "DUE DILIGENCE REPORT", MARGIN, 148, 12, "F2", colors.white, 3.1);
  rule(page, MARGIN, 174, BODY_W, 2, colors.gold);
  const titleLines = wrap(clean(title), 16, 430);
  titleLines.slice(0, 3).forEach((line, index) => text(page, line, MARGIN, 240 + index * 25, 16, "F1", [0.85, 0.82, 0.76]));
  const summaryLines = wrap(summaryForDisplay(summary || "Structured evidence review and due-diligence analysis."), 10.5, 490);
  summaryLines.slice(0, 7).forEach((line, index) => text(page, line, MARGIN, 340 + index * 17, 10.5, "F1", [0.78, 0.75, 0.7]));
  const stats = [[context.documents?.length || 0, "SUBMITTED DOCUMENTS"], [context.sources?.length || 0, "EVIDENCE SOURCES"], [context.findings?.length || 0, "RECORDED FINDINGS"]] as const;
  stats.forEach(([value, label], index) => {
    const x = MARGIN + index * 166;
    page.commands.push(`q 0.32 0.26 0.14 RG 1 w ${x} ${(PAGE_H - 518 - 73).toFixed(2)} 152 73 re S Q`);
    text(page, String(value), x + 12, 555, 24, "F3", colors.white);
    text(page, label, x + 12, 575, 6.7, "F2", [0.71, 0.67, 0.59], 0.9);
  });
  rule(page, MARGIN, 660, 122, 2, colors.gold);
  rect(page, MARGIN + 126, 655, 12, 12, colors.gold);
  text(page, `GENERATED ${new Date(generatedAt).toUTCString().toUpperCase()}`, MARGIN, 720, 7.4, "F1", [0.64, 0.6, 0.53], 0.9);
  text(page, "CONFIDENTIAL", MARGIN, 748, 7.4, "F2", [0.64, 0.6, 0.53], 1.2);
  return page;
}

function pageStream(page: PdfPage) { return page.commands.join("\n"); }

export function createReportPdf(title: string, summary: string, content: string, generatedAt: string, context: ReportContext = {}) {
  const pages: PdfPage[] = [cover(title, summary, generatedAt, context), standardPage()];
  const body = pages[pages.length - 1];
  if (!/^# MASTER SUMMARY — READ THIS FIRST\s*/im.test(content)) {
    heading(pages, "Executive decision summary");
    paragraph(pages, summaryForDisplay(summary || "No executive summary was supplied."), { panel: true });
  }
  evidencePanel(pages, context);
  qualityDashboard(pages, context);
  relationshipMap(pages, context);
  for (const block of parseMarkdown(content)) {
    if (block.type === "heading") heading(pages, block.text);
    else if (block.type === "bullet") paragraph(pages, block.text, { bullet: true });
    else if (block.type === "table") block.rows.forEach((row) => paragraph(pages, row, { panel: true }));
    else paragraph(pages, block.text);
  }
  closureRegister(pages, context);
  heading(pages, "Report use");
  paragraph(pages, "This report is generated from the durable Integritas evidence ledger. It distinguishes submitted evidence, external research, unresolved checks and analyst review; it is not a substitute for legal, regulatory or specialist advice.", { panel: true });
  if (body.cursor === 0) throw new Error("report layout was not initialized");
  pages.forEach((page, index) => { if (!page.dark) footer(page, index + 1, pages.length); });

  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalog = add("");
  const pagesObject = add("");
  const normalFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const serifFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const serifBoldFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = pageStream(page);
    const streamId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${normalFont} 0 R /F2 ${boldFont} 0 R /F3 ${serifFont} 0 R /F4 ${serifBoldFont} 0 R >> >> /Contents ${streamId} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(encoder.encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(encoder.encode(pdf));
}
