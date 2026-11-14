"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NeverBuyProduct, Product } from "@/lib/contracts";
import { shopApi } from "@/lib/shop-console/api";

interface NeverBuyPickerProps {
  products: NeverBuyProduct[];
  words: string[];
  onProducts: (next: NeverBuyProduct[]) => void;
  onWords: (next: string[]) => void;
}

type Found = { query: string; products: Product[]; failed?: boolean };

const SHOWN = 6;

/** Search the catalogue and add a product to the never-buy list, or a word every product name is checked for. */
export function NeverBuyPicker({ products, words, onProducts, onWords }: NeverBuyPickerProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | undefined>();
  const typed = query.trim();
  const searching = typed.length >= 2;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      shopApi
        .search({ query: typed, limit: SHOWN }, controller.signal)
        .then((response) => setFound({ query: typed, products: response.hits.map((hit) => hit.product) }))
        .catch(() => {
          if (!controller.signal.aborted) setFound({ query: typed, products: [], failed: true });
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, searching]);

  const current = searching && found?.query === typed ? found : undefined;
  const listed = new Set(products.map((item) => item.productId));
  const wordListed = words.some((word) => word.toLowerCase() === typed.toLowerCase());

  return (
    <div className="never-buy">
      <label className="never-buy-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Find a product</span>
        <input type="search" value={query} placeholder="Find a product" autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
      </label>

      {searching ? (
        <ul className="never-buy-results" aria-label="Products found" aria-busy={!current}>
          {current?.failed ? <li className="never-buy-empty">Search did not answer. Try again.</li> : null}
          {current && !current.failed && current.products.length === 0 ? <li className="never-buy-empty">No product found.</li> : null}
          {(current?.products ?? []).map((product) => {
            const on = listed.has(product.id);
            return (
              <li key={product.id} className="never-buy-row">
                <span className="never-buy-name">{product.name.en}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={on}
                  onClick={() => onProducts([...products, { productId: product.id, name: product.name.en }])}
                >
                  {on ? "On the list" : <><Plus aria-hidden="true" />Never buy</>}
                </button>
              </li>
            );
          })}
          {!wordListed ? (
            <li className="never-buy-row never-buy-word">
              <span className="never-buy-name">Any product named &ldquo;{typed}&rdquo;</span>
              <button type="button" className="btn btn-quiet" onClick={() => { onWords([...words, typed]); setQuery(""); }}>
                <Plus aria-hidden="true" />
                Never buy
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {products.length + words.length > 0 ? (
        <ul className="never-buy-list" aria-label="Never buy">
          {products.map((item) => (
            <li key={item.productId} className="never-buy-item">
              <span className="never-buy-name">{item.name}</span>
              <button type="button" className="icon-btn" aria-label={`Remove ${item.name}`} onClick={() => onProducts(products.filter((other) => other.productId !== item.productId))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
          {words.map((word) => (
            <li key={`word:${word}`} className="never-buy-item">
              <span className="never-buy-name">Any product named &ldquo;{word}&rdquo;</span>
              <button type="button" className="icon-btn" aria-label={`Remove ${word}`} onClick={() => onWords(words.filter((other) => other !== word))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="never-buy-none">Nothing on the list.</p>
      )}
    </div>
  );
}
