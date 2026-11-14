/**
 * The walkthrough's words. A card is one headline and one or two short sentences with the reason. Numbers and names
 * from the product are never typed into the text: a template names the fact, `{red}` or `{redName}`, and picks its
 * word by the count, `{red?line is:lines are}`.
 */

export interface StepCopy {
  title: string;
  detail?: string;
}

/** The limits the owner set for every card: a headline of about 8 words, about 30 words on the card. */
export const LIMITS = { title: 8, detail: 26, card: 32 } as const;

/** The facts a template may name: counts, and words read from the product (a line's reason, a product's name). */
export type Counts = Partial<Record<string, number | string>>;

const SLOT = /\{(\w+)(?:\?([^:}]*):([^}]*))?\}/g;

/** Fills a template from `counts`; undefined when a fact it names is not known yet. */
export function fill(template: string, counts: Counts): string | undefined {
  let missing = false;
  const text = template.replace(SLOT, (_, key: string, one?: string, many?: string) => {
    const value = counts[key];
    if (value === undefined) {
      missing = true;
      return "";
    }
    if (one === undefined || typeof value === "string") return String(value);
    return value === 1 ? one : (many ?? one);
  });
  return missing ? undefined : text;
}

export function fillCopy(copy: StepCopy, counts: Counts): StepCopy | undefined {
  const title = fill(copy.title, counts);
  const detail = copy.detail === undefined ? undefined : fill(copy.detail, counts);
  if (title === undefined || (copy.detail !== undefined && detail === undefined)) return undefined;
  return detail === undefined ? { title } : { title, detail };
}

/** Words as a reader counts them: a number is one word, punctuation is none. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function withinLimits(copy: StepCopy): boolean {
  const title = wordCount(copy.title);
  const detail = copy.detail ? wordCount(copy.detail) : 0;
  return title <= LIMITS.title && detail <= LIMITS.detail && title + detail <= LIMITS.card;
}
