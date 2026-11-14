export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "laituri-theme";
export const DEFAULT_THEME: Theme = "light";

/** Runs before first paint so a stored choice never flashes the other theme. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : DEFAULT_THEME;
}

/** Applies the theme to the document and remembers it; storage may be blocked, the page still switches. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}
