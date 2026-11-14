import { PackageOpen } from "lucide-react";
import Link from "next/link";
import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { orderOutcome } from "@/lib/console/format/orders";
import { roundingNote } from "@/lib/console/format/packs";
import { shortProductName } from "@/lib/console/format/product";
import { offerSubject } from "@/lib/console/format/proof";
import { substitutionTag } from "@/lib/console/format/substitution";
import { day, hourMinute } from "@/lib/console/format/time";
import { StateWord } from "../ui/StateWord";

interface OrdersTableProps {
  orders: Order[];
  ready: boolean;
  filtered: boolean;
  onOpen: (orderId: string) => void;
}

/** One row per order. The request cell holds the button, stretched over the row, that opens the order. */
export function OrdersTable({ orders, ready, filtered, onOpen }: OrdersTableProps) {
  return (
    <div className="table-frame">
      <table className="orders-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Asked for</th>
            <th scope="col">Ordered</th>
            <th scope="col">Delivery</th>
            <th scope="col" className="num">
              Net
            </th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={6}>
                {!ready ? (
                  "Loading orders…"
                ) : (
                  <span className="empty-note">
                    <PackageOpen aria-hidden="true" />
                    {filtered ? "No orders with this outcome." : "No orders yet."}
                    {filtered ? null : (
                      <Link href="/buyer" className="text-link strong">
                        Ask your agent for something
                      </Link>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const outcome = orderOutcome(order);
              const rounding = roundingNote(order.offer);
              // With a rounding note the packs are counted in the note, so the line names the product alone.
              const ordered = rounding ? order.offer.lines.map((line) => shortProductName(line.name)).join("; ") : offerSubject(order.offer);
              const asked = order.offer.intent?.trim() || ordered;
              const swap = substitutionTag(order);
              return (
                <tr key={order.id} data-outcome={outcome.key}>
                  <td className="cell-when">
                    <span>{day(order.createdAt)}</span>
                    <span className="sub">{hourMinute(order.createdAt)}</span>
                  </td>
                  <td className="cell-asked">
                    <button type="button" className="row-open" onClick={() => onOpen(order.id)}>
                      {asked}
                    </button>
                  </td>
                  <td className="cell-ordered" data-same={asked === ordered && !swap && !rounding}>
                    {ordered}
                    {swap ? (
                      <span className="order-tag">
                        <StateWord word={swap} tone="waiting" />
                      </span>
                    ) : null}
                    {rounding ? <span className="sub">{rounding}</span> : null}
                    <span className="sub delivery-inline">Delivers {day(order.offer.deliveryDate)}</span>
                  </td>
                  <td className="cell-delivery">{day(order.offer.deliveryDate)}</td>
                  <td className="cell-net num">{eur(order.offer.totals.net.amount)}</td>
                  <td className="cell-outcome">
                    <StateWord word={outcome.label} tone={outcome.tone} />
                    {outcome.rule ? <span className="sub">{outcome.rule}</span> : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
