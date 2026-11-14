import type { ReactNode } from "react";

interface RuleGroupProps {
  title: string;
  /** Soft: a person can approve past it. Hard: blocked, no override. */
  strength: "soft" | "hard";
  note: string;
  children: ReactNode;
}

export function RuleGroup({ title, strength, note, children }: RuleGroupProps) {
  const id = `rules-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="rule-group" aria-labelledby={id} data-strength={strength}>
      <header className="rule-group-head">
        <h2 id={id}>{title}</h2>
        <span className="strength" data-strength={strength}>
          {strength === "soft" ? "Soft" : "Hard"}
        </span>
      </header>
      <p className="rule-group-note">{note}</p>
      <ul className="rules">{children}</ul>
    </section>
  );
}

/** One rule as a sentence; `detail` holds what sits under it, such as chips or a usage meter. */
export function RuleSentence({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <li className="rule">
      <p className="rule-text">{children}</p>
      {detail ? <div className="rule-detail">{detail}</div> : null}
    </li>
  );
}
