import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** The challenge's five judging criteria, named and weighted exactly as published, with our evidence for each. */
const CRITERIA = [
  {
    name: "Working end-to-end demo",
    weight: 30,
    evidence: "A real agent searches the challenge's live catalogue, gets a signed offer and places an order. Three scenes run from the buyer side.",
  },
  {
    name: "Solving the problem and user need",
    weight: 20,
    evidence: "Valio Aimo can take agent orders it can trust, and the buyer's purchasing lead sets limits once and sees only what needs her.",
  },
  {
    name: "Autonomy and controls",
    weight: 20,
    evidence: "Fifteen rules in a signed mandate decide alone. Past a limit the order waits for a named person, and agents cannot approve.",
  },
  {
    name: "Robustness to exception situations",
    weight: 15,
    evidence: "Short stock, passed cut-offs, substitutes, expired offers and edited data each get a defined answer that is signed and logged.",
  },
  {
    name: "Openness and credible path toward production",
    weight: 15,
    evidence: "MCP and OpenAPI 3.1, keys published as JWKS, MIT licence. Any agent connects without asking us first.",
  },
];

/** How the work answers each criterion: the weights as one bar, then one sentence of evidence per criterion. */
export function Criteria() {
  return (
    <Reveal className="lp-section lp-criteria" aria-labelledby="lp-criteria-title">
      <div className="lp-criteria-head">
        <h2 id="lp-criteria-title" className="lp-h2 rv" style={stagger(0)}>
          How it meets the judging criteria.
        </h2>
        <Link href="/evidence" className="lp-text-link rv" style={stagger(1)}>
          See the evidence <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="lp-weights rv" style={stagger(1)} aria-hidden="true">
        {CRITERIA.map((criterion) => (
          <span key={criterion.name} style={{ flexGrow: criterion.weight }}>
            {criterion.weight}%
          </span>
        ))}
      </div>
      <ul className="lp-criteria-list">
        {CRITERIA.map((criterion, index) => (
          <li key={criterion.name} className="lp-criterion rv" style={stagger(index + 2)}>
            <span className="lp-criterion-weight">{criterion.weight}%</span>
            <h3 className="lp-h3">{criterion.name}</h3>
            <p>{criterion.evidence}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
