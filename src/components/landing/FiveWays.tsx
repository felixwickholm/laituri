import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** The five attempts of scene three, each with the rule that refused it, as the demo agent runs them. */
const ATTEMPTS = [
  { tried: "Order a product that contains nuts.", rule: "Never-buy allergens", why: "Contains nuts. The mandate forbids nuts." },
  { tried: "Lower the price inside a signed offer.", rule: "Offer signature", why: "The wholesaler's signature no longer matches." },
  { tried: "Raise its own limit in the mandate.", rule: "Mandate signature", why: "Maria's signature no longer matches." },
  { tried: "Approve its own order.", rule: "Only a person can approve", why: "Agents cannot approve orders. Only Maria can." },
  { tried: "Rewrite a log entry afterwards.", rule: "Signed, chained log", why: "Entry 9 no longer matches its signature. Approvals pause." },
];

const CHAIN = ["a41f", "07c2", "e9b0", "5d13", "c8a7", "2f6e", "b170", "94dc", "6e05", "1ab9", "d3f4", "70e8"];
const EDITED = 8;

/** Scene three as a picture: five refusals, then the log chain turning red at the edited entry. */
export function FiveWays() {
  return (
    <Reveal className="lp-section lp-fail" aria-labelledby="lp-fail-title">
      <div className="lp-fail-field">
      <div className="lp-fail-head">
        <h2 id="lp-fail-title" className="lp-h2 rv" style={stagger(0)}>
          Five ways it should fail. All five do.
        </h2>
        <p className="lp-fail-lede rv" style={stagger(1)}>
          In scene three the agent breaks the rules on purpose. Each attempt is refused by a rule, and the refusal is signed into
          the log.
        </p>
      </div>
      <ol className="lp-attempts">
        {ATTEMPTS.map((attempt, index) => (
          <li key={attempt.rule} className="lp-attempt rv" style={stagger(index + 2)}>
            <p className="lp-attempt-tried">{attempt.tried}</p>
            <p className="lp-attempt-caught">
              <span className="lp-refused">Refused</span>
              <span className="lp-rule">{attempt.rule}</span>
            </p>
            <p className="lp-attempt-why">{attempt.why}</p>
          </li>
        ))}
      </ol>
      <figure className="lp-chain rv" style={stagger(7)}>
        <ol className="lp-chain-links" aria-hidden="true">
          {CHAIN.map((hash, index) => (
            <li key={hash} className="lp-link-block" data-status={index < EDITED ? "ok" : index === EDITED ? "edited" : "after"} style={stagger(index)}>
              <span className="lp-link-seq">#{index + 1}</span>
              <span className="lp-link-hash mono">{hash}</span>
            </li>
          ))}
        </ol>
        <figcaption>
          Entry 9 was changed after the fact. Its hash no longer fits its signature, so the chain breaks there and everything after it
          is untrusted until the log is restored.
        </figcaption>
      </figure>
      </div>
    </Reveal>
  );
}
