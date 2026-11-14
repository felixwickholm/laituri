"use client";

import { Plus } from "lucide-react";
import type { SearchHit } from "@/lib/contracts";
import { categoryGroupLabel } from "@/lib/catalog/build/groups";
import { shortProductName } from "@/lib/console/format/product";
import { lineAmountText, lineFor, type CartLine } from "@/lib/shop-console/cart";
import {
  allergenSentences,
  availabilityText,
  co2Text,
  comparisonText,
  countryName,
  deliveryText,
  labelChips,
  packLabel,
  reliabilityText,
  unitPriceText,
} from "@/lib/shop-console/format";
import { Sheet } from "../ui/Sheet";
import { QtyStepper } from "./QtyStepper";
import { SimilarProducts } from "./SimilarProducts";
import { StockWord } from "./StockWord";
import { ProductImage } from "./ProductImage";

interface Props {
  /** The product last opened; it stays while the sheet slides away. */
  hit: SearchHit | undefined;
  open: boolean;
  inCart: CartLine | undefined;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
  onSet: (productId: string, packs: number) => void;
  onSearch: (words: string) => void;
}

/** Everything about one product: price, stock, delivery, what Valio Aimo vouches for, allergens and similar products. */
export function ProductSheet({ hit, open, inCart, onClose, onAdd, onSet, onSearch }: Props) {
  if (!hit) return null;
  const { product, facts, offerPreview: preview } = hit;
  const name = shortProductName(product.name.en);
  const pack = packLabel(product);
  const labels = labelChips(product, facts);
  const origin = countryName(facts.countryOfOrigin ?? product.origin);
  const reliability = reliabilityText(facts.deliveryReliability ?? product.deliveryReliability);
  const co2 = co2Text(facts.categoryAverageCo2PerKg ?? product.co2PerKg);
  const delivery = deliveryText(preview);
  const compare = preview ? comparisonText(preview) : undefined;

  const footer = inCart ? (
    <QtyStepper packs={inCart.packs} step={inCart.step} amount={lineAmountText(inCart)} name={name} onChange={(packs) => onSet(product.id, packs)} />
  ) : (
    <button type="button" className="btn btn-primary big wide" disabled={!preview?.orderable} onClick={() => onAdd(lineFor(hit, name, pack))}>
      <Plus aria-hidden="true" />
      Add to cart
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} kicker={categoryGroupLabel(product.categoryGroup)} title={product.name.en} lede={`${product.brand ?? product.vendor}. Product ${product.id}.`} footer={footer}>
      <div className="store-detail">
        <ProductImage productId={product.id} name={product.name.en} group={product.categoryGroup} src={hit.image} size={160} className="store-detail-image" />
        <div className="store-detail-price">
          {preview ? (
            <>
              <strong>{unitPriceText(preview, product.salesUnit)}</strong>
              {compare ? <span>{compare}</span> : null}
            </>
          ) : (
            <span>No live price right now.</span>
          )}
          <p className="store-detail-note">Estimate. Your order gets a fixed price.</p>
        </div>
        <dl className="store-facts">
          <div>
            <dt>Pack</dt>
            <dd>{pack}</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd>
              <StockWord {...availabilityText(preview)} />
            </dd>
          </div>
          {delivery ? (
            <div>
              <dt>Delivery</dt>
              <dd>{delivery}</dd>
            </div>
          ) : null}
        </dl>

        <section aria-labelledby="store-vouch-title">
          <h3 id="store-vouch-title">What Valio Aimo vouches for</h3>
          <dl className="store-facts">
            <div>
              <dt>Origin</dt>
              <dd>{origin ?? "Not recorded."}</dd>
            </div>
            <div>
              <dt>Labels</dt>
              <dd>
                {labels.length ? (
                  <ul className="store-tags">
                    {labels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                ) : (
                  "No labels recorded."
                )}
              </dd>
            </div>
            <div>
              <dt>On time</dt>
              <dd>{reliability ?? "No delivery history yet."}</dd>
            </div>
            <div>
              <dt>Carbon</dt>
              <dd>{co2 ? `${co2}. An average for the category, not this product.` : "No figure recorded."}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="store-allergen-title">
          <h3 id="store-allergen-title">Allergens</h3>
          {allergenSentences(product.allergens).map((sentence) => (
            <p key={sentence} className="store-allergen">
              {sentence}
            </p>
          ))}
        </section>

        <SimilarProducts ids={product.substitutes} onSearch={onSearch} />
      </div>
    </Sheet>
  );
}
