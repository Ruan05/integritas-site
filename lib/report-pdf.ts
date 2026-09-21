const encoder = new TextEncoder();

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width = 88) {
  const rows: string[] = [];
  for (const sourceLine of text.replace(/\r/g, "").split("\n")) {
    if (!sourceLine.trim()) {
      rows.push("");
      continue;
    }
    let line = sourceLine;
    while (line.length > width) {
      const cut = line.lastIndexOf(" ", width);
      const index = cut > 20 ? cut : width;
      rows.push(line.slice(0, index));
      line = line.slice(index).trimStart();
    }
    rows.push(line);
  }
  return rows;
}

function pageStream(lines: string[]) {
  const commands = ["BT", "/F1 10 Tf", "50 780 Td", "13 TL"];
  for (const line of lines) {
    commands.push(`(${pdfEscape(line)}) Tj`, "0 -13 Td");
  }
  commands.push("ET");
  return commands.join("\n");
}

export function createReportPdf(title: string, summary: string, content: string, generatedAt: string) {
  const rows = [
    "INTEGRITAS DUE-DILIGENCE REPORT",
    title,
    `Generated: ${generatedAt}`,
    "",
    summary || "No summary was supplied.",
    "",
    ...content.split(/\r?\n/),
  ].flatMap((line) => wrap(line));
  const pages: string[][] = [];
  for (let index = 0; index < rows.length; index += 52) pages.push(rows.slice(index, index + 52));
  if (!pages.length) pages.push(["No report content is available."]);

  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalog = add("");
  const pagesObject = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = pageStream(page);
    const streamId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${streamId} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(encoder.encode(pdf));
}
