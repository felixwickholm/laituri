import type { CSSProperties } from "react";

/**
 * The brand kit (brand/final), inline so it follows the theme: the quay in the text colour, the docked agent block in
 * our own blue (`--mark-agent`), never in a Valio Aimo colour. The partner logo is the unchanged file from its site.
 */

const QUAY = "M0 4A4 4 0 0 1 4 0L8 0A4 4 0 0 1 12 4L12 28L36 28A4 4 0 0 1 40 32L40 36A4 4 0 0 1 36 40L4 40A4 4 0 0 1 0 36Z";
const AGENT = "M20 4A4 4 0 0 1 24 0L36 0A4 4 0 0 1 40 4L40 16A4 4 0 0 1 36 20L24 20A4 4 0 0 1 20 16Z";
/** "Laituri" in Inter Display SemiBold, as outlines, on the quay's baseline. */
const LETTERS =
  "M2.66 0H23.18V-4.92H8.34V-32.01H2.66ZM32.64 0.37C36.33 0.37 38.24 -1.18 39.32 -3.2H39.4V0H44.73V-15.47C44.73 -20.2 41.23 -23.14 35.32 -23.14C29.39 -23.14 25.7 -20.15 25.44 -15.64H30.66C30.81 -17.55 32.57 -18.93 35.21 -18.93C37.81 -18.93 39.36 -17.55 39.36 -15.62V-15.45C39.36 -13.9 37.92 -13.84 33.71 -13.36C29.03 -12.87 24.79 -11.6 24.79 -6.45C24.79 -1.91 28.12 0.37 32.64 0.37ZM33.97 -3.65C31.6 -3.65 30.08 -4.71 30.08 -6.49C30.08 -8.55 32.06 -9.39 34.38 -9.73C36.61 -10.08 38.72 -10.42 39.38 -10.85V-8.4C39.38 -5.76 37.51 -3.65 33.97 -3.65ZM48.64 0H54.06V-22.69H48.64ZM51.35 -26.06C53.2 -26.06 54.59 -27.39 54.59 -29.15C54.59 -30.89 53.2 -32.23 51.35 -32.23C49.5 -32.23 48.11 -30.89 48.11 -29.15C48.11 -27.39 49.5 -26.06 51.35 -26.06ZM70.3 -22.69H65.68V-28.88H60.24V-22.69H56.29V-18.33H60.24V-5.71C60.24 -1.83 62.41 0 67.03 0H70.3V-4.36H67.98C66.22 -4.36 65.68 -4.9 65.68 -6.51V-18.33H70.3ZM80.91 0.45C84.05 0.45 86.35 -0.92 87.9 -3.48V0H93.22V-22.69H87.79V-9.86C87.79 -5.99 85.68 -4.3 82.83 -4.3C79.93 -4.3 78.25 -6.04 78.25 -9.37V-22.69H72.84V-8.51C72.84 -2.69 76.17 0.45 80.91 0.45ZM97.16 0H102.57V-12.85C102.57 -16.39 104.57 -18.18 107.15 -18.18C108.22 -18.18 109.3 -18.07 109.7 -18V-22.82C109.27 -22.86 108.67 -22.9 107.94 -22.9C105.02 -22.9 103.28 -21.53 102.44 -18.93H102.38V-22.69H97.16ZM112.09 0H117.5V-22.69H112.09ZM114.8 -26.06C116.64 -26.06 118.04 -27.39 118.04 -29.15C118.04 -30.89 116.64 -32.23 114.8 -32.23C112.95 -32.23 111.55 -30.89 111.55 -29.15C111.55 -27.39 112.95 -26.06 114.8 -26.06Z";

/** The mark alone: 24 px or larger (below that the favicon is the mark). */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g transform="translate(4 4)">
        <path fill="currentColor" d={QUAY} />
        <path fill="var(--mark-agent)" d={AGENT} />
      </g>
    </svg>
  );
}

/** The mark kept by the approval phone's older import name. */
export const DockMark = Mark;

/** Our lockup: the mark and "Laituri". `height` is the lockup's box, the mark's own margin included. */
export function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <svg className="wordmark" height={height} width={(height * 179.91) / 48} viewBox="0 0 179.91 48" role="img" aria-label="Laituri">
      <g transform="translate(4 4)">
        <path fill="currentColor" d={QUAY} />
        <path fill="var(--mark-agent)" d={AGENT} />
        <path fill="currentColor" d={LETTERS} transform="translate(52 40)" />
      </g>
    </svg>
  );
}

/** Valio Aimo's own logo, unchanged: petrol on light, white on dark. 18 px high or more; a stylesheet may set `--va-h`. */
export function ValioAimoLogo({ height }: { height: number }) {
  return (
    <span className="va-logo" style={{ "--va-h": `${height}px` } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size SVG file, nothing to optimise */}
      <img src="/brand/valio-aimo-logo-petrol.svg" alt="Valio Aimo" data-theme-only="light" />
      {/* eslint-disable-next-line @next/next/no-img-element -- the same logo for the dark theme */}
      <img src="/brand/valio-aimo-logo-white.svg" alt="" data-theme-only="dark" />
    </span>
  );
}

/**
 * The header the app and the landing page open with, as Valio Aimo's own site sets it: their logo leads, a thin rule,
 * then our product, smaller: the mark, "Laituri" in the display face and "The dock for AI agents" under it.
 * "stack" puts our product under the logo (sidebar); "row" and "bar" set it beside it. Only "row" keeps the line.
 */
export function BrandHeader({ layout, logoHeight }: { layout: "stack" | "row" | "bar"; logoHeight: number }) {
  return (
    <span className="brand-header" data-layout={layout}>
      <ValioAimoLogo height={logoHeight} />
      <span className="brand-product">
        <Mark size={layout === "bar" ? 24 : 28} />
        <span className="brand-product-text">
          <span className="brand-product-name">Laituri</span>
          {layout === "row" ? <span className="brand-product-line">The dock for AI agents</span> : null}
        </span>
      </span>
    </span>
  );
}
