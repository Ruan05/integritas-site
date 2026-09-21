import React from "react";
import {
  Document,
  Line,
  Page,
  Rect,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

type ReportContext = {
  documents?: unknown[];
  sources?: Array<{ evidence_origin?: string | null; source_type?: string | null }>;
  findings?: unknown[];
  checks?: Array<{ status?: string | null }>;
};

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; rows: string[] };

const ink = "#111111";
const gold = "#B99746";
const parchment = "#F6F2EA";
const muted = "#6C665E";

const styles = StyleSheet.create({
  cover: { backgroundColor: "#090909", color: "#F7F3EA", padding: 44, fontFamily: "Helvetica" },
  coverRule: { backgroundColor: gold, height: 2, marginTop: 20, marginBottom: 24 },
  eyebrow: { color: "#C9AF6A", fontSize: 9, letterSpacing: 2.2, textTransform: "uppercase" },
  brand: { fontFamily: "Times-Roman", fontSize: 38, marginTop: 18 },
  coverTitle: { fontSize: 13, letterSpacing: 3.2, marginTop: 8, textTransform: "uppercase" },
  coverCase: { color: "#D9D2C6", fontSize: 15, lineHeight: 1.45, marginTop: 42, maxWidth: 430 },
  coverSummary: { color: "#C8C1B7", fontSize: 10.5, lineHeight: 1.65, marginTop: 22, maxWidth: 490 },
  coverFooter: { bottom: 44, color: "#9D958A", fontSize: 8.5, left: 44, letterSpacing: 1, position: "absolute", textTransform: "uppercase" },
  metricRow: { flexDirection: "row", gap: 10, marginTop: 38 },
  metricDark: { borderColor: "#5A4B28", borderWidth: 1, flexGrow: 1, padding: 11 },
  metricValue: { color: "#F7F3EA", fontFamily: "Times-Roman", fontSize: 22 },
  metricLabel: { color: "#B7AD9F", fontSize: 7.5, letterSpacing: 1.2, marginTop: 4, textTransform: "uppercase" },
  page: { backgroundColor: parchment, color: ink, fontFamily: "Helvetica", paddingBottom: 48, paddingHorizontal: 44, paddingTop: 54 },
  pageHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  headerBrand: { color: ink, fontFamily: "Times-Roman", fontSize: 17 },
  headerCaption: { color: muted, fontSize: 7.5, letterSpacing: 1.25, textTransform: "uppercase" },
  headerRule: { backgroundColor: gold, height: 1.2, marginBottom: 22 },
  section: { marginBottom: 18 },
  sectionHeading: { color: "#6F571E", fontFamily: "Times-Bold", fontSize: 15, lineHeight: 1.25, marginBottom: 8 },
  paragraph: { color: "#292723", fontSize: 10, lineHeight: 1.55, marginBottom: 7 },
  bullet: { color: "#292723", fontSize: 9.7, lineHeight: 1.55, marginBottom: 5, paddingLeft: 10 },
  tableRow: { backgroundColor: "#ECE5D7", borderBottomColor: "#D5C9B2", borderBottomWidth: 0.5, color: "#302D28", fontSize: 8.6, lineHeight: 1.4, marginBottom: 1, padding: 7 },
  evidencePanel: { backgroundColor: "#E9E0CF", borderColor: "#D2C29E", borderWidth: 0.7, marginBottom: 21, padding: 13 },
  evidenceTitle: { color: "#745B22", fontSize: 8.5, letterSpacing: 1.45, textTransform: "uppercase" },
  evidenceRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  metricLight: { borderColor: "#D1C39F", borderWidth: 0.7, flexGrow: 1, padding: 8 },
  metricLightValue: { color: ink, fontFamily: "Times-Roman", fontSize: 17 },
  metricLightLabel: { color: muted, fontSize: 6.8, letterSpacing: 0.9, marginTop: 2, textTransform: "uppercase" },
  barLabel: { color: muted, fontSize: 7.4, letterSpacing: 0.7, marginTop: 11, textTransform: "uppercase" },
  barTrack: { backgroundColor: "#D0C6B2", height: 4, marginTop: 4, width: "100%" },
  barFill: { backgroundColor: gold, height: 4 },
  footer: { bottom: 20, color: muted, fontSize: 7.2, left: 44, position: "absolute", right: 44, textAlign: "center" },
  disclaimer: { color: muted, fontSize: 7.5, lineHeight: 1.45, marginTop: 3 },
});

function clean(value: string) {
  return value
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRow(line: string) {
  return line.split("|").map((cell) => clean(cell)).filter(Boolean).join("  •  ");
}

function isDivider(line: string) {
  return /^\s*\|?\s*:?-{2,}/.test(line);
}

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    const text = clean(paragraph.join(" "));
    if (text) blocks.push({ type: "paragraph", text });
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
      if (rows.length) blocks.push({ type: "table", rows: rows.slice(0, 20) });
      continue;
    }
    const bullet = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (bullet) { flush(); blocks.push({ type: "bullet", text: clean(bullet[1]) }); continue; }
    paragraph.push(line);
  }
  flush();
  return blocks.length ? blocks : [{ type: "paragraph", text: "No narrative report content was supplied." }];
}

function number(value: unknown) { return Array.isArray(value) ? value.length : 0; }

function EvidencePanel({ context }: { context: ReportContext }) {
  const documents = number(context.documents);
  const sources = number(context.sources);
  const findings = number(context.findings);
  const checks = number(context.checks);
  const completedChecks = (context.checks || []).filter((check) => check?.status === "complete").length;
  const external = (context.sources || []).filter((source) => source?.evidence_origin === "external_research").length;
  const coverage = checks ? Math.round((completedChecks / checks) * 100) : 0;
  return (
    <View style={styles.evidencePanel}>
      <Text style={styles.evidenceTitle}>Evidence snapshot</Text>
      <View style={styles.evidenceRow}>
        <View style={styles.metricLight}><Text style={styles.metricLightValue}>{documents}</Text><Text style={styles.metricLightLabel}>Documents</Text></View>
        <View style={styles.metricLight}><Text style={styles.metricLightValue}>{sources}</Text><Text style={styles.metricLightLabel}>Sources</Text></View>
        <View style={styles.metricLight}><Text style={styles.metricLightValue}>{findings}</Text><Text style={styles.metricLightLabel}>Findings</Text></View>
        <View style={styles.metricLight}><Text style={styles.metricLightValue}>{checks}</Text><Text style={styles.metricLightLabel}>Checks</Text></View>
      </View>
      <Text style={styles.barLabel}>Completed checks {completedChecks}/{checks || 0} · external sources {external}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${coverage}%` }]} /></View>
    </View>
  );
}

function Cover({ title, summary, generatedAt, context }: { title: string; summary: string; generatedAt: string; context: ReportContext }) {
  const documents = number(context.documents);
  const sources = number(context.sources);
  const findings = number(context.findings);
  return (
    <Page size="LETTER" style={styles.cover}>
      <Text style={styles.eyebrow}>Private investigation workspace</Text>
      <Text style={styles.brand}>Integritas</Text>
      <Text style={styles.coverTitle}>Due diligence report</Text>
      <View style={styles.coverRule} />
      <Text style={styles.coverCase}>{clean(title)}</Text>
      <Text style={styles.coverSummary}>{clean(summary || "Structured evidence review and due-diligence analysis.")}</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricDark}><Text style={styles.metricValue}>{documents}</Text><Text style={styles.metricLabel}>Submitted documents</Text></View>
        <View style={styles.metricDark}><Text style={styles.metricValue}>{sources}</Text><Text style={styles.metricLabel}>Evidence sources</Text></View>
        <View style={styles.metricDark}><Text style={styles.metricValue}>{findings}</Text><Text style={styles.metricLabel}>Recorded findings</Text></View>
      </View>
      <Svg height="42" width="510" style={{ marginTop: 36 }}><Rect x="0" y="20" width="510" height="1" fill="#6D5824" /><Line x1="0" y1="20" x2="120" y2="20" stroke={gold} strokeWidth="2" /><Rect x="122" y="15" width="10" height="10" fill={gold} /></Svg>
      <Text style={styles.coverFooter}>Generated {new Date(generatedAt).toUTCString()} · Confidential</Text>
    </Page>
  );
}

function ReportPage({ blocks, context }: { blocks: Block[]; context: ReportContext }) {
  return (
    <Page size="LETTER" style={styles.page} wrap>
      <View style={styles.pageHeader} fixed><Text style={styles.headerBrand}>Integritas</Text><Text style={styles.headerCaption}>Due diligence report</Text></View>
      <View style={styles.headerRule} fixed />
      <EvidencePanel context={context} />
      {blocks.map((block, index) => {
        if (block.type === "heading") return <View key={`h-${index}`} style={styles.section} wrap={false}><Text style={styles.sectionHeading}>{block.text}</Text></View>;
        if (block.type === "bullet") return <Text key={`b-${index}`} style={styles.bullet}>•  {block.text}</Text>;
        if (block.type === "table") return <View key={`t-${index}`} style={styles.section}>{block.rows.map((row, rowIndex) => <Text key={`r-${rowIndex}`} style={styles.tableRow}>{row}</Text>)}</View>;
        return <Text key={`p-${index}`} style={styles.paragraph}>{block.text}</Text>;
      })}
      <View wrap={false} style={styles.section}>
        <Text style={styles.sectionHeading}>Report use</Text>
        <Text style={styles.disclaimer}>This report is generated from the durable Integritas evidence ledger. It distinguishes submitted evidence, external research, unresolved checks and analyst review; it is not a substitute for legal, regulatory or specialist advice.</Text>
      </View>
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `CONFIDENTIAL  ·  INTEGRITAS  ·  ${pageNumber} / ${totalPages}`} />
    </Page>
  );
}

export async function createReportPdf(title: string, summary: string, content: string, generatedAt: string, context: ReportContext = {}) {
  const document = <Document title={`Integritas - ${clean(title)}`} author="Integritas" subject="Due-diligence report"><Cover title={title} summary={summary} generatedAt={generatedAt} context={context} /><ReportPage blocks={parseMarkdown(content)} context={context} /></Document>;
  const rendered = await renderToBuffer(document);
  return new Uint8Array(rendered);
}
