export const MAXIMUM_DEPTH_REPORT_HEADINGS = Object.freeze([
  "Master summary",
  "Immediate action / To-Do list with exact completion instructions",
  "Scope, evidence standard and investigation method",
  "Evidence package, provenance and forensic status",
  "Corporate registry, legal status and identity resolution",
  "Ownership, UBO and control lane",
  "People, identity and authority lane",
  "Historical continuity and related-entity lane",
  "Address, physical presence and geospatial lane",
  "Domain, website, email, telephone and digital-provenance lane",
  "Banking, debt, enforcement and financial-risk lane",
  "Petroleum product, refinery, storage, terminal and licence lane",
  "Trade, export, customs, logistics and vessel lane",
  "Procurement, producer and commercial-footprint lane",
  "Sanctions, PEP, adverse media, enforcement and litigation lane",
  "Criminal-case reconstruction",
  "Entity and relationship map",
  "Timeline / chronology",
  "Contradiction and anomaly register",
  "Claim-to-evidence matrix",
  "Integrated risk matrix and decision dashboard",
  "Open-gate / closure register",
  "Comprehensive search coverage and lane-completion audit",
  "Alternative / benign explanation analysis",
  "Transaction controls and verification protocol",
  "Final conclusion",
  "Independent critic / four-eyes review",
  "Methodology, limitations and source ledger",
]);

const MINIMUM_REPORT_CHARACTERS = 8000;
const MINIMUM_SECTION_CHARACTERS = 260;

export function hasVerifiedMaximumDepthStructure(model, markdown) {
  if (!model || model.quality?.report_structure !== "maximum_depth_edd_28_v1_verified") return false;
  const text = String(markdown || "");
  if (text.length < MINIMUM_REPORT_CHARACTERS) return false;
  const lines = text.split(/\r?\n/);
  const headingRows = lines
    .map((line, lineIndex) => ({ line: line.trim(), lineIndex }))
    .filter(({ line }) => /^#\s+/.test(line));
  if (headingRows.length !== MAXIMUM_DEPTH_REPORT_HEADINGS.length) return false;

  let previousLineIndex = -1;
  return headingRows.every(({ line, lineIndex }, index) => {
    if (line !== `# ${index + 1}. ${MAXIMUM_DEPTH_REPORT_HEADINGS[index]}`) return false;
    const nextLineIndex = headingRows[index + 1]?.lineIndex ?? lines.length;
    const sectionBody = lines.slice(lineIndex + 1, nextLineIndex).join("\n").trim();
    if (lineIndex <= previousLineIndex || sectionBody.length < MINIMUM_SECTION_CHARACTERS) return false;
    previousLineIndex = lineIndex;
    return true;
  });
}
