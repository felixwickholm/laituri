/**
 * Instructions in a buyer's request that are not about the product: a spending ceiling ("under 50 euros",
 * "max 200 €", "alle 50 euroa") and an order to wait for a person ("do not order until I approve",
 * "ask me first", "älä tilaa ennen kuin hyväksyn"). Both are read in English, Finnish and Swedish.
 */
export interface BuyerInstructions {
  /** The words with the instructions taken out, for reading quantity, date and product. */
  rest: string;
  /** The most the buyer will pay, in euros. */
  budget?: number;
  /** The buyer wants a person to approve before anything is ordered. */
  waitForPerson: boolean;
}

const AMOUNT = String.raw`(?<![\d.,])(?:\d{1,3}(?:[ \u00a0.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![.,]?\d)`;
const CURRENCY_AFTER = String.raw`(?:€|eur(?:o(?:a|n|lla|ssa|t|s)?)?\b|e\b)`;
/** "€50", "50 €", "50 euros", "50 euroa", "50e". */
const MONEY = String.raw`(?:€\s*(?<lead>${AMOUNT})|(?<trail>${AMOUNT})\s*${CURRENCY_AFTER})`;
const CEILING = String.raw`under|below|less than|at most|max(?:imum)?\.?|up to|no more than|not more than|within|budget(?: of| is)?|alle|enintään|korkeintaan|maksimissaan|budjetti(?:lla|na)?|högst|budget(?:en)?`;
/** A price per litre, kilo or unit is not a ceiling on the order; it stays in the words as something not understood. */
const PER_UNIT = String.raw`\s*(?:\/|per\b|a (?:litre|liter|kilo|kg|unit|piece)\b|litralta|kilolta|kilo\b|litra\b|st\b)`;

/** A word boundary that also knows letters such as ä and ö, which a plain word boundary does not. */
const EDGE = String.raw`(?:(?<!\p{L})(?=\p{L})|(?<=\p{L})(?!\p{L}))`;

/** Case-insensitive and Unicode-aware, with \\b read as a letter boundary. */
function pattern(source: string): RegExp {
  return new RegExp(source.replaceAll(String.raw`\b`, EDGE), "iu");
}

const BUDGET = pattern(String.raw`(?:\b(?:${CEILING})\s*:?\s*)?${MONEY}(?!${PER_UNIT})(?:\s*(?:budget\p{L}*|budjeti\p{L}*|max(?:imum)?\b))?`);

const WAIT_FOR_PERSON: RegExp[] = [
  String.raw`\b(?:do not|don't|dont|never|not)\s+(?:yet\s+)?(?:order|buy|place|confirm|send)\b[^.!?;]*`,
  String.raw`\bnot\s+yet\b[^.!?;]*`,
  String.raw`\b(?:ask|check with)\s+(?:me|us)\b(?:\s+(?:first\b|before\b[^.!?;]*))?`,
  String.raw`\b(?:wait|hold)\b[^.!?;]*`,
  String.raw`\b(?:only\s+)?(?:with|after|needs?|requires?)\s+(?:my|our)\s+(?:approval|ok|sign-off)\b`,
  String.raw`\b(?:get|wait for)\s+(?:my|our)\s+(?:approval|ok|sign-off)\b[^.!?;]*`,
  String.raw`\bälä\s+(?:vielä\s+)?(?:tilaa|osta)\b[^.!?;]*`,
  String.raw`\bei\s+vielä\b[^.!?;]*`,
  String.raw`\bkysy\s+(?:(?:minulta|meiltä)(?:\s+ensin)?|ensin)\b`,
  String.raw`\bodota\b[^.!?;]*`,
  String.raw`\bvasta\s+kun\b[^.!?;]*?\bhyväksy\p{L}*[^.!?;]*`,
  String.raw`\b(?:beställ|köp)\s+(?:inte|ännu inte)\b[^.!?;]*`,
  String.raw`\binte\s+(?:än|ännu|beställa|köpa)\b[^.!?;]*`,
  String.raw`\bfråga\s+(?:mig|oss)\b(?:\s+först\b)?`,
  String.raw`\bvänta\b[^.!?;]*`,
].map(pattern);

/** "1 000,50" or "1.000" -> number; a single comma or point with one or two digits after it is a decimal. */
function amountOf(raw: string): number {
  const compact = raw.replace(/[ \u00a0]/g, "");
  const decimal = compact.match(/^(.*)[.,](\d{1,2})$/);
  if (decimal) return Number(`${decimal[1].replace(/[.,]/g, "")}.${decimal[2]}`);
  return Number(compact.replace(/[.,]/g, ""));
}

function cut(text: string, match: RegExpExecArray): string {
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
}

export function readInstructions(text: string): BuyerInstructions {
  let rest = text;
  let waitForPerson = false;
  for (const instruction of WAIT_FOR_PERSON) {
    const match = instruction.exec(rest);
    if (!match) continue;
    waitForPerson = true;
    rest = cut(rest, match);
  }
  let budget: number | undefined;
  for (let match = BUDGET.exec(rest); match; match = BUDGET.exec(rest)) {
    const amount = amountOf(match.groups?.lead ?? match.groups?.trail ?? "");
    // Zero is a ceiling too: "budget 0 euros" allows nothing to be ordered alone.
    if (amount >= 0) budget = Math.min(budget ?? amount, amount);
    rest = cut(rest, match);
  }
  return { rest: rest.replace(/\s+/g, " ").trim(), budget, waitForPerson };
}
