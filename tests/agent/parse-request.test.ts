import { describe, expect, it } from "vitest";
import { parseNumber, parseRequest } from "@/lib/agent";

// Saturday 14 Nov 2026, 09:00 in Helsinki.
const NOW = new Date("2026-11-14T09:00:00+02:00");

type Row = [text: string, amount: number | undefined, unit: string | undefined, deliverBy: string, phrase: string];

const ROWS: Row[] = [
  ["1,000 litres of lactose-free milk by Monday", 1000, "l", "2026-11-16", "lactose-free milk"],
  ["1000 litraa laktoositonta maitoa maanantaiksi", 1000, "l", "2026-11-16", "laktoositonta maitoa"],
  ["milk for Monday", undefined, undefined, "2026-11-16", "milk"],
  ["50 kg butter by Monday", 50, "kg", "2026-11-16", "butter"],
  ["200 l lactose-free milk", 200, "l", "2026-11-16", "lactose-free milk"],
  ["3 000 litres of lactose-free milk by Monday", 3000, "l", "2026-11-16", "lactose-free milk"],
  ["40 liters oat drink by Tuesday", 40, "l", "2026-11-17", "oat drink"],
  ["500 g butter tomorrow", 0.5, "kg", "2026-11-15", "butter"],
  ["20 kiloa voita huomiseksi", 20, "kg", "2026-11-15", "voita"],
  ["12 kpl kermaa perjantaiksi", 12, "sales_unit", "2026-11-20", "kermaa"],
  ["200 units of product 462775 by Monday", 200, "sales_unit", "2026-11-16", ""],
  ["1,5 kg cheese by 2026-11-18", 1.5, "kg", "2026-11-18", "cheese"],
  ["10 pcs yoghurt for Wednesday", 10, "sales_unit", "2026-11-18", "yoghurt"],
  ["25 kilos of flour by 17.11.", 25, "kg", "2026-11-17", "flour"],
  ["some dairy stuff, about a thousand", 1000, "sales_unit", "2026-11-16", "dairy stuff"],
  ["jag behöver tre lådor smör till fredag", 3, "sales_unit", "2026-11-20", "smör"],
  ["kaks laatikkoa kermaa", 2, "sales_unit", "2026-11-16", "kermaa"],
  ["5 dl cream", 0.5, "l", "2026-11-16", "cream"],
  ["2.5l cream on Saturday", 2.5, "l", "2026-11-21", "cream"],
  ["100 litraa kaurajuomaa keskiviikkona", 100, "l", "2026-11-18", "kaurajuomaa"],
  ["1 litre milk", 1, "l", "2026-11-16", "milk"],
];

describe("parseRequest", () => {
  it.each(ROWS)("%s", (text, amount, unit, deliverBy, phrase) => {
    const parsed = parseRequest(text, NOW);
    expect(parsed.quantity?.amount).toBe(amount);
    expect(parsed.quantity?.unit).toBe(unit);
    expect(parsed.deliverBy).toBe(deliverBy);
    expect(parsed.phrase).toBe(phrase);
  });

  it("reads a product code", () => {
    expect(parseRequest("200 units of product 462775 by Monday", NOW).productId).toBe("462775");
  });

  it("assumes the next working day when no date is given", () => {
    const parsed = parseRequest("200 l lactose-free milk", NOW);
    expect(parsed.deliverByStated).toBe(false);
    expect(parsed.deliverBy).toBe("2026-11-16");
  });

  it("takes the next Monday on a Monday", () => {
    expect(parseRequest("5 l milk by Monday", new Date("2026-11-16T09:00:00+02:00")).deliverBy).toBe("2026-11-23");
  });

  it("uses the Helsinki date late in the evening", () => {
    expect(parseRequest("5 l milk tomorrow", new Date("2026-11-14T23:30:00+02:00")).deliverBy).toBe("2026-11-15");
  });

  it.each([
    ["1,000", 1000],
    ["1.000", 1000],
    ["1,5", 1.5],
    ["12", 12],
  ])("parses %s", (raw, value) => {
    expect(parseNumber(raw)).toBe(value);
  });
});

describe("an answer to the agent's question", () => {
  const at = new Date("2026-11-15T00:30:00Z");
  it("reads the answer first and takes only what it leaves out from the earlier request", () => {
    const butter = parseRequest("10 kg smör\nEarlier: jag behöver smör och grädde till fredag, minst 10 kg smör", at);
    expect(butter).toMatchObject({ phrase: "smör", quantity: { amount: 10, unit: "kg" }, deliverBy: "2026-11-20", deliverByStated: true });
    expect(butter.text).toBe("10 kg smör, by 2026-11-20");
    const cream = parseRequest("20 l\nEarlier: kaks laatikkoa kermaa huomiseksi", at);
    expect(cream).toMatchObject({ phrase: "kermaa", quantity: { amount: 20, unit: "l" }, deliverBy: "2026-11-16" });
    expect(cream.packageWord).toBeUndefined();
    const milk = parseRequest("lactose-free milk for Tuesday\nEarlier: 20 litres", at);
    expect(milk).toMatchObject({ phrase: "lactose-free milk", quantity: { amount: 20, unit: "l" }, deliverBy: "2026-11-17", text: "lactose-free milk for Tuesday, 20 l" });
  });
});
