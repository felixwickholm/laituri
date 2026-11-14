import { withEuroSign } from "./money";
import { tidyProductText } from "./product";
import { day } from "./time";

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;

/** A server sentence in console style: "€1,010.00" for amounts, "Mon 16 Nov" for dates, no trademark clutter. */
export function plainSentence(text: string): string {
  const plain = tidyProductText(withEuroSign(text)).replace(ISO_DATE, (_, date: string) => day(date));
  return plain ? plain[0].toUpperCase() + plain.slice(1) : plain;
}
