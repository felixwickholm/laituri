import type { CSSProperties } from "react";
import { productImage } from "@/lib/catalog/images";

/**
 * A product's picture in a square box. A photo is a packshot: contained on a light tile so a tall bottle and a
 * wide box both fit. Without a photo, the drawn category tile fills the box.
 */
export function ProductImage({
  productId,
  name,
  group,
  src,
  size,
  className,
}: {
  productId: string;
  name: string;
  group: string;
  /** The search hit's own picture path, when the screen has one. */
  src?: string;
  size: number;
  className?: string;
}) {
  const fallback = productImage(productId, group);
  const path = src ?? fallback.src;
  const kind = src ? (src.includes("/placeholders/") ? "placeholder" : "photo") : fallback.kind;
  return (
    <span className={className ? `product-image ${className}` : "product-image"} data-kind={kind} style={{ "--size": `${size}px` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small static files under /public; no resizing needed */}
      <img src={path} alt={name} width={size} height={size} loading="lazy" decoding="async" />
    </span>
  );
}
