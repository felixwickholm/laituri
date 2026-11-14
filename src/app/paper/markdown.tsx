import Link from "next/link";
import type { ReactNode } from "react";
import { linkTarget, withoutMarkers } from "@/lib/discovery/paper";

/**
 * A small Markdown reader for docs/paper.md: headings, paragraphs, lists, block quotes, tables, fenced code, code
 * spans, links, autolinks, bold and <br>. It builds React elements, never raw HTML.
 */

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** A code span that is a page of this site ("/buyer?tour=1") becomes a link to it. */
const SITE_PATH = /^\/[\w\-./?=&]*$/;

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[((?:[^\]`]|`[^`]*`)+)\]\(([^)\s]+)\))|(<(https?:\/\/[^>\s]+)>)|(<br\s*\/?>)/g;

function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const k = `${key}-${n++}`;
    if (match[1]) {
      const code = match[1].slice(1, -1);
      out.push(
        SITE_PATH.test(code) ? (
          <a key={k} href={code} className="pp-code-link">
            <code>{code}</code>
          </a>
        ) : (
          <code key={k}>{code}</code>
        ),
      );
    } else if (match[2]) {
      out.push(<strong key={k}>{inline(match[2].slice(2, -2), k)}</strong>);
    } else if (match[3]) {
      out.push(link(match[4], match[5], k));
    } else if (match[6]) {
      out.push(
        <a key={k} href={match[7]} rel="noopener">
          {match[7]}
        </a>,
      );
    } else {
      out.push(<br key={k} />);
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Repo files are named, not linked: the site does not serve the source. Pages of the site and the web are linked. */
function link(label: string, target: string, key: string): ReactNode {
  const where = linkTarget(target);
  switch (where.kind) {
    case "web":
      return (
        <a key={key} href={where.href} rel="noopener">
          {inline(label, key)}
        </a>
      );
    case "site":
      return (
        <Link key={key} href={where.href}>
          {inline(label, key)}
        </Link>
      );
    case "anchor":
      return (
        <a key={key} href={where.href}>
          {inline(label, key)}
        </a>
      );
    case "repo":
      return label.includes(where.path) ? (
        <span key={key} className="pp-repo" title={`In the repository: ${where.path}`}>
          {inline(label, key)}
        </span>
      ) : (
        <span key={key} className="pp-repo">
          {inline(label, key)} (<code>{where.path}</code>)
        </span>
      );
  }
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

const isTableRule = (line: string | undefined) => line !== undefined && /^\|?\s*:?-{3,}/.test(line.trim());

/** Renders the paper. Headings get ids, collected in `headings` for the table of contents. */
export function renderPaper(markdown: string): { nodes: ReactNode[]; headings: Heading[] } {
  const lines = withoutMarkers(markdown).split("\n");
  const nodes: ReactNode[] = [];
  const headings: Heading[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || /^<!--.*-->$/.test(line.trim())) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      const text = heading[2];
      const id = slug(text);
      headings.push({ depth, text: text.replace(/`/g, ""), id });
      const Tag = `h${depth}` as "h1" | "h2" | "h3" | "h4";
      nodes.push(
        <Tag key={key()} id={id}>
          {inline(text, id)}
        </Tag>,
      );
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      nodes.push(
        <pre key={key()} className="pp-pre">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      const k = key();
      nodes.push(
        <blockquote key={k}>
          <p>{inline(body.join(" "), k)}</p>
        </blockquote>,
      );
      continue;
    }
    if (line.trim().startsWith("|") && isTableRule(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      const k = key();
      nodes.push(
        <div key={k} className="pp-table" role="region" aria-label="Table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {head.map((cell, c) => (
                  <th key={c} scope="col">
                    {inline(cell, `${k}h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell, `${k}r${r}c${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        let item = lines[i++].replace(marker, "");
        // A wrapped item continues on indented lines.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !marker.test(lines[i])) item += ` ${lines[i++].trim()}`;
        items.push(item);
      }
      const k = key();
      const List = ordered ? "ol" : "ul";
      nodes.push(
        <List key={k}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${k}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) body.push(lines[i++]);
    if (body.length === 0) body.push(lines[i++]);
    const k = key();
    nodes.push(<p key={k}>{inline(body.join(" "), k)}</p>);
  }
  return { nodes, headings };
}
