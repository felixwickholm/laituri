import { evidence } from "@/lib/evidence";
import { llmsText } from "./llms";
import { paperAsText } from "./paper";

/**
 * /llms-full.txt (written to public/ by `npm run evidence`): the whole picture in one fetch. The paper (what Laituri is, each judging criterion with how to
 * verify it, the scenarios, the threat table, what is simulated, the path to production, how to evaluate it), then
 * the agent's own guide from /llms.txt with its REST flow and every link.
 */
export function llmsFullText(origin: string, paper: string): string {
  const e = evidence();
  const body = paperAsText(paper, origin).split("\n");
  const title = body[0].startsWith("# ") ? body[0] : `# ${e.name}`;
  const guide = llmsText(origin)
    .split("\n")
    .slice(1)
    .map((line) => (line.startsWith("## ") ? `#${line}` : line));
  return [
    title,
    "",
    `> ${e.pitch}`,
    `> This file is the paper (${origin}/paper) followed by the guide an agent follows to buy (${origin}/llms.txt). Live demo: ${e.live}. Evidence as JSON: ${origin}/evidence.json.`,
    "",
    ...body.slice(body[0].startsWith("# ") ? 1 : 0),
    "",
    "## For agents: connect and buy",
    ...guide,
  ].join("\n");
}
