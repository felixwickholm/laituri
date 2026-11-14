import { ChainEntry } from "./ChainEntry";

/** A faint picture of what the log will look like, so the empty pane shows its shape. */
export function ChainExample() {
  return (
    <div className="example" aria-hidden="true">
      <p className="example-label">Example</p>
      <ol className="audit-list chain">
        <ChainEntry state="verified" title="Order confirmed" detail="Valio Aimo confirmed 1,000 × Arki Eila lactose-free milk 1 l." time="09:14:08" />
        <ChainEntry state="verified" title="Offer signed by Valio Aimo" detail="Fixed price €1,010.00 net, delivered Mon 16 Nov." time="09:14:02" />
      </ol>
    </div>
  );
}
