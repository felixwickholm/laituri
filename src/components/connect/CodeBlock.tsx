import { CopyButton } from "../ui/CopyButton";
import type { CodeBlock as Code } from "@/lib/connect/guides";

/** A command or config in the mono face. Long lines scroll inside the block, never the page. */
export function CodeBlock({ code }: { code: Code }) {
  return (
    <div className="cx-code" data-wrap={code.wrap ? "" : undefined}>
      <pre className="mono" tabIndex={0}>
        <code>{code.value}</code>
      </pre>
      <CopyButton value={code.value} label={code.label} />
    </div>
  );
}
