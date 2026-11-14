import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AgentBasket } from "@/lib/shop-console/agent-watch";
import { LineCounts } from "./LineCounts";

/** In the cart area: what your agent just ordered in this workspace, with the line states. */
export function AgentBasketNote({ basket }: { basket: AgentBasket }) {
  return (
    <div className="store-agent-basket" aria-live="polite">
      <p>{basket.sentence}</p>
      <LineCounts counts={basket.counts} />
      <Link href="/buyer" className="text-link">
        Check it in Today
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}
