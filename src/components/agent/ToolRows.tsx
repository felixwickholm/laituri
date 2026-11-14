import { plainSentence } from "@/lib/console/format/sentence";
import type { Activity } from "@/lib/console/types";

/** The raw calls behind a step, demoted to small sub-rows: the tool name in mono, the result in words. */
export function ToolRows({ tools }: { tools: Activity[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className="tool-rows">
      {tools.map((tool) => (
        <li key={tool.id} data-status={tool.status}>
          <span className="tool-name mono">{tool.tool ?? "call"}</span>
          <span className="tool-text">{plainSentence(tool.detail ?? tool.title)}</span>
        </li>
      ))}
    </ul>
  );
}
