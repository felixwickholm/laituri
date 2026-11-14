"use client";

import { motion, useReducedMotion } from "motion/react";
import { isOpen, quantity } from "@/lib/console/basket";
import type { BasketLine } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { LineActions } from "./LineActions";
import { StateMark } from "./StateMark";
import type { Resolver } from "./useResolve";

interface BasketLineRowProps {
  line: BasketLine;
  resolver?: Resolver;
  onOpenOrder?: (orderId: string) => void;
}

/** "1,000 l lactose-free milk": the amount leads unless the buyer's words already say it. */
function askedText(line: BasketLine): string {
  return line.words.includes(String(line.asked.amount)) ? line.words : `${quantity(line.asked)} ${line.words}`;
}

/** One line: state, the buyer's words, the product and packs, the reason, the net, and the choices when it needs a person. */
export function BasketLineRow({ line, resolver, onOpenOrder }: BasketLineRowProps) {
  const reduce = useReducedMotion();
  const working = line.state === "working";
  const product = working ? "" : [line.product?.name, line.packs].filter(Boolean).join(" · ");
  const reason = line.resolved?.sentence ?? (working ? "" : line.reason);
  const open = isOpen(line) && resolver;
  return (
    <motion.li
      layout={reduce ? false : "position"}
      layoutId={reduce ? undefined : `line-${line.id}`}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="basket-line"
      data-tour="basket-line"
      data-state={line.state}
      data-open={Boolean(open)}
    >
      <StateMark state={line.state} bare />
      <div className="line-main">
        {line.orderId && onOpenOrder ? (
          <button type="button" className="line-asked row-open" onClick={() => onOpenOrder(line.orderId as string)}>
            {askedText(line)}
          </button>
        ) : (
          <p className="line-asked">{askedText(line)}</p>
        )}
        {product ? <p className="line-product">{product}</p> : null}
        {reason ? <p className="line-reason">{reason}</p> : null}
      </div>
      <span className="line-net num">{line.net !== undefined && line.state !== "working" ? eur(line.net) : ""}</span>
      {open ? <LineActions line={line} resolver={resolver} /> : null}
    </motion.li>
  );
}
