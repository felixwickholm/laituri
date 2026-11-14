import { Bot, Building2, Check, ChefHat, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Side } from "../shell/nav";

interface Column {
  key: string;
  icon: LucideIcon;
  who: string;
  can: string[];
  never?: string[];
}

function columns(side: Side): Column[] {
  return [
    {
      key: "agent",
      icon: Bot,
      who: side === "buyer" ? "Your agent" : "The customer’s agent",
      can: ["Search products.", "Get fixed prices.", side === "buyer" ? "Order inside your limits." : "Order inside the customer’s limits."],
      never: ["Raise its own limits.", "Change a price.", "Approve its own order.", "Buy when Valio Aimo has paused it."],
    },
    {
      key: "kitchen",
      icon: ChefHat,
      who: "A person at the customer",
      can: ["Sets the limits.", "Decides what needs a person.", "Approves or stops an order."],
    },
    {
      key: "valio",
      icon: Building2,
      who: "Valio Aimo",
      can: ["Signs each price.", "Can pause any agent.", "Sees which rule held an order."],
    },
  ];
}

/** Who may do what, in three large columns of plain words. */
export function WhoCanDo({ side }: { side: Side }) {
  return (
    <section className="sec-block" aria-labelledby="who-title">
      <h2 id="who-title" className="section-title">
        Who can do what
      </h2>
      <div className="sec-who">
        {columns(side).map((column) => (
          <article key={column.key} className="glass pad sec-who-col" data-who={column.key}>
            <header className="sec-who-head">
              <column.icon aria-hidden="true" />
              <h3>{column.who}</h3>
            </header>
            <p className="sec-who-label">Can</p>
            <ul className="sec-who-list">
              {column.can.map((item) => (
                <li key={item} data-kind="can">
                  <Check aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {column.never ? (
              <>
                <p className="sec-who-label">Never</p>
                <ul className="sec-who-list">
                  {column.never.map((item) => (
                    <li key={item} data-kind="never">
                      <X aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
