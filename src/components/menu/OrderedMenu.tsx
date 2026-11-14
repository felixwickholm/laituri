import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BasketCard } from "@/components/basket/BasketCard";

interface OrderedMenuProps {
  basketId: string;
  title: string;
  onNew: () => void;
}

/** After "Order this menu": the same basket card as Today, with its lines turning green, orange or red. */
export function OrderedMenu({ basketId, title, onNew }: OrderedMenuProps) {
  return (
    <section className="ordered" aria-labelledby="ordered-title">
      <h2 id="ordered-title" className="ordered-title">
        Your agent is ordering {title}.
      </h2>
      <BasketCard basketId={basketId} />
      <div className="ordered-actions">
        <Link className="btn btn-primary big" href={`/buyer?basket=${encodeURIComponent(basketId)}`}>
          Open in Today
          <ArrowRight aria-hidden />
        </Link>
        <button type="button" className="btn btn-quiet big" onClick={onNew}>
          Plan another event
        </button>
      </div>
    </section>
  );
}
