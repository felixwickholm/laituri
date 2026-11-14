"use client";

import { Plus } from "lucide-react";
import type { SearchHit } from "@/lib/contracts";
import { shortProductName } from "@/lib/console/format/product";
import { lineAmountText, lineFor, type CartLine } from "@/lib/shop-console/cart";
import { availabilityText, comparisonText, deliveryText, labelChips, packLabel, unitPriceText } from "@/lib/shop-console/format";
import { ProductImage } from "./ProductImage";
import { QtyStepper } from "./QtyStepper";
import { StockWord } from "./StockWord";

const CARD_LABELS = 2;

interface Props {
  hit: SearchHit;
  inCart: CartLine | undefined;
  /** Your agent ordered this product just now. */
  agentPicked: boolean;
  onAdd: (line: CartLine) => void;
  onSet: (productId: string, packs: number) => void;
  onOpen: (hit: SearchHit) => void;
}

/** One product as a card in the grid: what it is, when it comes, what it costs, and the add control. */
export function ProductCard({ hit, inCart, agentPicked, onAdd, onSet, onOpen }: Props) {
  const { product, offerPreview: preview } = hit;
  const name = shortProductName(product.name.en);
  const pack = packLabel(product);
  const stock = availabilityText(preview);
  const delivery = deliveryText(preview);
  const labels = labelChips(product, hit.facts);
  const orderable = preview?.orderable ?? false;
  const line = lineFor(hit, name, pack);
  const compare = preview ? comparisonText(preview) : undefined;

  return (
    <li className="store-card" data-agent={agentPicked ? "" : undefined}>
      <div className="store-card-visual">
        <ProductImage productId={product.id} name={name} group={product.categoryGroup} src={hit.image} size={112} />
        {labels.length ? (
          <ul className="store-tags" aria-label="Labels">
            {labels.slice(0, CARD_LABELS).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {agentPicked ? <p className="store-agent-tag">Your agent ordered this</p> : null}
      <button type="button" className="store-card-name" onClick={() => onOpen(hit)}>
        {name}
      </button>
      <p className="store-card-pack">{pack}</p>
      <div className="store-card-facts">
        <StockWord {...stock} />
        {delivery ? <p className="store-card-when">{delivery}</p> : null}
      </div>
      <div className="store-card-buy">
        <p className="store-price">
          {preview ? (
            <>
              <strong>{unitPriceText(preview, product.salesUnit)}</strong>
              {compare ? <span>{compare}</span> : null}
            </>
          ) : (
            <span>No live price</span>
          )}
        </p>
        {inCart ? (
          <QtyStepper packs={inCart.packs} step={inCart.step} amount={lineAmountText(inCart)} name={name} onChange={(packs) => onSet(product.id, packs)} />
        ) : (
          <button type="button" className="btn btn-secondary store-add" onClick={() => onAdd(line)} disabled={!orderable} aria-label={`Add ${name}`}>
            <Plus aria-hidden="true" />
            Add
          </button>
        )}
      </div>
    </li>
  );
}
