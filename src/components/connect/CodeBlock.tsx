import { Fragment } from "react";
import { CopyButton } from "../ui/CopyButton";
import type { CodeBlock as Code } from "@/lib/connect/guides";

/** Wrapped text breaks only at spaces, never inside a flag such as --header or a word such as lactose-free. */
function wordsKeptWhole(value: string) {
  return value.split(" ").map((word, index) => (
    <Fragment key={index}>
      {index > 0 ? " " : null}
      <span className="cx-word">{word}</span>
    </Fragment>
  ));
}

/** A command or config in the mono face. Long lines wrap or scroll inside the block, never the page; the copy is the value as is. */
export function CodeBlock({ code }: { code: Code }) {
  return (
    <div className="cx-code" data-wrap={code.wrap ? "" : undefined}>
      <pre className="mono" tabIndex={0}>
        <code>{code.wrap ? wordsKeptWhole(code.value) : code.value}</code>
      </pre>
      <CopyButton value={code.value} label={code.label} />
    </div>
  );
}
