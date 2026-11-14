const MAX = 48;
const MARKS = /[®™©]/g;
const FILLER = /\b(hyvä suomalainen|suomesta)\b/gi;
const SIZE = /(\d+(?:[.,]\d+)?)\s?(kg|g|ml|dl|cl|l)\b/i;
const CLAIMS: [RegExp, string][] = [
  [/\b(lactose[- ]free|laktoositon)\b/i, "lactose-free"],
  [/\b(organic|luomu)\b/i, "organic"],
];
const PHRASES: [RegExp, string][] = [
  [/\bsemi skimmed\b/gi, "semi-skimmed"],
  [/\bfat free\b/gi, "fat-free"],
  [/\bmilk drink\b/gi, "milk"],
];

function squeeze(text: string): string {
  return text.replace(/\s*,\s*(?=,|$)/g, "").replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "");
}

/** Removes trademark marks and marketing filler from a sentence that mentions products. */
export function tidyProductText(text: string): string {
  return text.replace(MARKS, "").replace(FILLER, "").replace(/ {2,}/g, " ").replace(/ ([,.])/g, "$1").trim();
}

/** Shortens the words, never the pack size: "Viola light natural cream lactose-free… 3,5 kg". */
function cap(core: string, size: string): string {
  const budget = MAX - (size ? size.length + 1 : 0);
  let text = core;
  if (text.length > budget) {
    const cut = text.slice(0, budget - 1);
    const space = cut.lastIndexOf(" ");
    text = `${(space > budget / 2 ? cut.slice(0, space) : cut).replace(/[\s,.-]+$/, "")}…`;
  }
  return size ? `${text} ${size}` : text;
}

/**
 * A product name short enough for a list: the variety, the claim that matters and the pack size.
 * "Valio Hyvä suomalainen Arki® Eila® semi skimmed milk drink 1 l lactose free" -> "Arki Eila semi-skimmed lactose-free milk 1 l".
 * Capped at about 48 characters; the pack size always survives.
 */
export function shortProductName(name: string): string {
  let text = name.replace(MARKS, " ").replace(FILLER, " ");
  // Valio is the wholesaler's own brand; when a variety name follows, the variety is what people recognise.
  text = text.replace(/^\s*Valio\s+(?=[A-ZÅÄÖ])/, "");
  const size = text.match(SIZE);
  if (size) text = text.replace(size[0], " ");
  const claims: string[] = [];
  for (const [pattern, word] of CLAIMS) {
    if (pattern.test(text)) {
      claims.push(word);
      text = text.replace(new RegExp(pattern.source, "gi"), " ");
    }
  }
  for (const [pattern, word] of PHRASES) text = text.replace(pattern, word);
  const words = squeeze(text).split(" ").filter(Boolean);
  if (claims.length) words.splice(Math.max(words.length - 1, 0), 0, ...claims);
  const sized = size ? `${size[1]}\u00a0${size[2].toLowerCase()}` : "";
  return cap(squeeze(words.join(" ")), sized);
}
