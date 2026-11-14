import type { OrbTone } from "@/lib/console/orb-params";

export type OrbTheme = "light" | "dark";

/** The colours one frame is drawn with. Bands run from the top of the sphere to the bottom. */
export interface OrbPalette {
  theme: OrbTheme;
  bands: string[];
  glyph: string;
  dust: string;
  /** The page's monospace family, resolved from its token, for the deal's glyphs. */
  fontMono: string;
  /** Opacity of the nearest and the farthest dots. */
  front: number;
  back: number;
  /** Dot size multiplier: dark dots glow on their own, light dots need more ink to read on a pale ground. */
  dot: number;
  /** A soft light behind the sphere; dark theme only. */
  glow?: string;
  tones: Record<Exclude<OrbTone, "none">, string>;
}

/** Ink on paper: deep petrol at the top through Valio Aimo petrol to our own blue at the bottom. */
const LIGHT_BANDS = ["#002d3b", "#003f55", "#005670", "#0b5f8a", "#1a56b8", "#1f4fd8"];
/** Light on night water: pale periwinkle at the top to blue to a cool cyan at the bottom. */
const DARK_BANDS = ["#dbe5ff", "#b4c8ff", "#8db0ff", "#6e9bff", "#5fa6f0", "#58b7e0"];

function token(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

/** Reads the state colours from the page tokens so the orb always matches the theme in force. */
export function readPalette(root: HTMLElement = document.documentElement): OrbPalette {
  const theme: OrbTheme = root.dataset.theme === "dark" ? "dark" : "light";
  const styles = getComputedStyle(root);
  const tones = {
    accent: token(styles, "--accent", theme === "dark" ? "#6e9bff" : "#1f4fd8"),
    warn: token(styles, "--warn", theme === "dark" ? "#f0a23b" : "#b25e09"),
    danger: token(styles, "--danger", theme === "dark" ? "#ff6b5b" : "#c4321f"),
    success: token(styles, "--success", theme === "dark" ? "#34c08e" : "#12805c"),
  };
  const fontMono = token(styles, "--font-mono", "ui-monospace, monospace");
  if (theme === "dark") {
    return { theme, bands: DARK_BANDS, glyph: "#c8d6ff", dust: "#8db0ff", fontMono, front: 0.95, back: 0.16, dot: 1, glow: "rgba(110, 155, 255, 0.16)", tones };
  }
  return { theme, bands: LIGHT_BANDS, glyph: "#003f55", dust: "#005670", fontMono, front: 1, back: 0.3, dot: 1.7, tones };
}
