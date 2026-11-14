import type { CSSProperties } from "react";

/** The place of a part in its section's entrance; CSS turns it into a delay. */
export function stagger(order: number): CSSProperties {
  return { "--i": order } as CSSProperties;
}
