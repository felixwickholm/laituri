import type { Mandate } from "@/lib/contracts";
import { autonomyOf } from "@/lib/policy/autonomy";

/** Who decides what, read from the rules themselves: what the agent does alone, and what it brings to a person. */
export function AutonomyColumns({ mandate }: { mandate: Mandate }) {
  const { alone, asks } = autonomyOf(mandate);
  return (
    <div className="autonomy">
      <div className="autonomy-col" data-tier="alone">
        <h3>Alone</h3>
        <ul>
          {alone.map((item) => (
            <li key={`${item.rule}:${item.text}`}>{item.text}</li>
          ))}
        </ul>
      </div>
      <div className="autonomy-col" data-tier="asks">
        <h3>Asks you</h3>
        <ul>
          {asks.map((item) => (
            <li key={`${item.rule}:${item.text}`}>{item.text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
