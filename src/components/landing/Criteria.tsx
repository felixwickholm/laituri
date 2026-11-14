import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** The challenge's judging criteria, named and weighted as on Valio Aimo's printed sheet. */
const CRITERIA = [
  { name: "Working end-to-end demo", weight: 30 },
  { name: "Solving the user’s need", weight: 20 },
  { name: "Autonomy and controls (guardrails)", weight: 20 },
  { name: "Robustness to exceptions", weight: 15 },
  { name: "Openness and path to production", weight: 15 },
];

/** One strip: each criterion at its weight, all leading to the evidence. */
export function Criteria() {
  return (
    <Reveal className="lp-criteria" aria-labelledby="lp-criteria-title">
      <div className="lp-criteria-inner">
        <div className="lp-criteria-head rv" style={stagger(0)}>
          <h2 id="lp-criteria-title" className="lp-h2">
            The judging criteria
          </h2>
          <Link href="/evidence" className="lp-text-link">
            See the evidence for each
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <ol className="lp-criteria-list rv" style={stagger(1)}>
          {CRITERIA.map((criterion) => (
            <li key={criterion.name} style={{ flexGrow: criterion.weight }}>
              <Link href="/evidence">
                <span className="lp-criterion-weight">{criterion.weight}%</span>
                <span className="lp-criterion-name">{criterion.name}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}
