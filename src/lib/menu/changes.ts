import type { KitchenAmount, LineChange, MenuChanges } from "@/lib/contracts";

/** What a menu needs, by the words on its shopping lines. */
export type NeedAmounts = Map<string, KitchenAmount>;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * What changes in the order when the guest count or the menu changes: every line whose amount differs, with from and to.
 * A line that is new starts from zero; a line that is gone ends at zero.
 */
export function menuChanges(before: NeedAmounts, after: NeedAmounts, guestsBefore: number, guestsAfter: number): MenuChanges {
  const words = [...new Set([...before.keys(), ...after.keys()])];
  const lines: LineChange[] = [];
  for (const word of words) {
    const from = before.get(word);
    const to = after.get(word);
    const unit = (to ?? from)!.unit;
    const fromAmount = from?.unit === unit ? from.amount : 0;
    const toAmount = to?.unit === unit ? to.amount : 0;
    if (fromAmount !== toAmount) lines.push({ words: word, from: { amount: fromAmount, unit }, to: { amount: toAmount, unit } });
  }
  return { sentence: changeSentence(lines, before, after, guestsBefore, guestsAfter), lines };
}

function changeSentence(lines: LineChange[], before: NeedAmounts, after: NeedAmounts, guestsBefore: number, guestsAfter: number): string {
  const guests = guestsBefore === guestsAfter ? `Still ${guestsAfter} guests` : `${guestsAfter} guests instead of ${guestsBefore}`;
  if (lines.length === 0) return `${guests}: nothing changes in the order.`;
  const added = [...after.keys()].filter((word) => !before.has(word)).length;
  const dropped = [...before.keys()].filter((word) => !after.has(word)).length;
  if (added || dropped) {
    return `${guests}, other dishes: ${plural(added, "new line", "new lines")}, ${plural(dropped, "line", "lines")} dropped.`;
  }
  const smaller = lines.filter((line) => line.to.amount < line.from.amount).length;
  const bigger = lines.length - smaller;
  if (bigger === 0) return `${guests}: ${plural(smaller, "line gets", "lines get")} smaller.`;
  if (smaller === 0) return `${guests}: ${plural(bigger, "line gets", "lines get")} bigger.`;
  return `${guests}: ${smaller} smaller, ${bigger} bigger.`;
}
