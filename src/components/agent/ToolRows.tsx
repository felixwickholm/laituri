import { toolLine } from "@/lib/console/format/run-view";
import type { Activity } from "@/lib/console/types";

/** The raw calls behind a step, demoted to small mono sub-rows. */
export function ToolRows({ tools }: { tools: Activity[] }) {
  if (tools.length === 0) return null;
  return (
    <ul className="tool-rows">
      {tools.map((tool) => (
        <li key={tool.id} className="mono" data-status={tool.status}>
          {toolLine(tool)}
        </li>
      ))}
    </ul>
  );
}
