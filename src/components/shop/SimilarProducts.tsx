"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/contracts";
import { shortProductName } from "@/lib/console/format/product";
import { shopApi } from "@/lib/shop-console/api";
import { packLabel } from "@/lib/shop-console/format";

const SHOWN = 3;

/** The wholesaler's own substitutes for a product. Pressing one searches for it, so its live price shows. */
export function SimilarProducts({ ids, onSearch }: { ids: string[]; onSearch: (words: string) => void }) {
  const wanted = ids.slice(0, SHOWN);
  const key = wanted.join(",");
  const [loaded, setLoaded] = useState<{ key: string; products: Product[] }>({ key: "", products: [] });

  useEffect(() => {
    if (!key) return;
    let stopped = false;
    Promise.allSettled(key.split(",").map((id) => shopApi.product(id))).then((results) => {
      if (stopped) return;
      setLoaded({ key, products: results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])) });
    });
    return () => {
      stopped = true;
    };
  }, [key]);

  if (!wanted.length || loaded.key !== key || !loaded.products.length) return null;
  return (
    <section className="store-similar" aria-labelledby="store-similar-title">
      <h3 id="store-similar-title">Similar products</h3>
      <ul>
        {loaded.products.map((product) => {
          const name = shortProductName(product.name.en);
          return (
            <li key={product.id}>
              <button type="button" onClick={() => onSearch(name)}>
                <span>
                  <strong>{name}</strong>
                  <span>{packLabel(product)}</span>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
