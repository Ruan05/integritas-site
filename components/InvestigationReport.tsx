import type { ReactNode } from "react";

// The dossier is investigation data. Render a small, escaped Markdown subset
// as React nodes rather than allowing report content to become executable HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-[#F0E5CE]">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-white/8 px-1 py-0.5 font-mono text-xs text-[#E4C45F]">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="break-all text-[#E4C45F] underline underline-offset-2">{link[1]}</a>;
    return part;
  });
}

function isBlock(line: string) {
  return /^#{1,6}\s|^[-*]\s|^\d+\.\s|^```|^\|/.test(line) || /^-{3,}$/.test(line.trim());
}

export default function InvestigationReport({ content }: { content: string }) {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = (heading[1].length <= 2 ? "h2" : "h3") as "h2" | "h3";
      blocks.push(<Tag key={i} className="mt-8 border-b border-[#D4AF37]/20 pb-2 font-serif text-xl leading-snug text-[#E4C45F] sm:text-2xl">{inline(heading[2])}</Tag>);
      i += 1; continue;
    }
    if (/^```/.test(line)) {
      const start = i++;
      const code: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      if (i < lines.length) i += 1;
      blocks.push(<pre key={start} className="my-4 overflow-x-auto border border-white/10 bg-black/40 p-4 text-xs whitespace-pre-wrap text-[#CFC5B5]">{code.join("\n")}</pre>);
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const start = i;
      const header = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
      blocks.push(<div key={start} className="my-5 overflow-x-auto border border-[#D4AF37]/20"><table className="w-full min-w-[34rem] border-collapse text-left text-xs leading-5"><thead className="bg-[#D4AF37]/10 text-[#E4C45F]"><tr>{header.map((cell, n) => <th key={n} className="border-b border-[#D4AF37]/20 px-3 py-2 font-semibold">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, n) => <tr key={n} className="border-b border-white/8 align-top">{header.map((_, c) => <td key={c} className="px-3 py-2 text-[#C9C0B3]">{inline(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^[-*]\s|^\d+\.\s/.test(line)) {
      const start = i;
      const ordered = /^\d+\.\s/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s/ : /^[-*]\s/).test(lines[i].trim())) items.push(lines[i++].trim().replace(ordered ? /^\d+\.\s/ : /^[-*]\s/, ""));
      const list = items.map((item, n) => <li key={n} className="pl-1">{inline(item)}</li>);
      blocks.push(ordered ? <ol key={start} className="my-3 list-decimal space-y-2 pl-6 text-[#C9C0B3]">{list}</ol> : <ul key={start} className="my-3 list-disc space-y-2 pl-6 text-[#C9C0B3]">{list}</ul>);
      continue;
    }
    if (/^-{3,}$/.test(line)) { blocks.push(<hr key={i++} className="my-6 border-white/10" />); continue; }
    const start = i;
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && (i === start || !isBlock(lines[i].trim()))) paragraph.push(lines[i++].trim());
    blocks.push(<p key={start} className="my-3 leading-7 text-[#C9C0B3]">{inline(paragraph.join(" "))}</p>);
  }
  return <article className="min-w-0 break-words text-sm sm:text-[15px]">{blocks}</article>;
}
