import { describe, expect, it } from "vitest";
import { parseRequest } from "@/lib/agent";
import { readInstructions } from "@/lib/request/instructions";

const NOW = new Date("2026-11-14T09:00:00+02:00");

describe("instructions in the buyer's words", () => {
  it.each([
    ["80 l milk under 50 euros", 50],
    ["80 l milk, max 200 €", 200],
    ["80 l milk at most €1,250.50", 1250.5],
    ["80 l milk budget 1 000 €", 1000],
    ["80 litraa maitoa alle 50 euroa", 50],
    ["80 litraa maitoa korkeintaan 200 e", 200],
    ["80 litraa maitoa 300 euron budjetilla", 300],
    ["80 l mjölk högst 90 euro", 90],
  ])("reads the ceiling in %s", (text, budget) => {
    expect(readInstructions(text).budget).toBe(budget);
  });

  it("leaves a price per litre in the words, as something not understood", () => {
    const read = readInstructions("80 l milk at €1.20/l");
    expect(read.budget).toBeUndefined();
    expect(read.rest).toContain("1.20");
  });

  it.each([
    "do not order until I approve",
    "Don't buy before I say so",
    "ask me first",
    "wait for my approval",
    "only with my approval",
    "älä tilaa ennen kuin hyväksyn",
    "kysy minulta ensin",
    "odota hyväksyntääni",
    "beställ inte förrän jag godkänner",
    "fråga mig först",
  ])("reads an order to wait in '%s'", (instruction) => {
    const read = readInstructions(`200 l lactose-free milk by Monday, ${instruction}`);
    expect(read.waitForPerson).toBe(true);
    expect(read.rest).toBe("200 l lactose-free milk by Monday,");
  });

  it("keeps plain requests as they are", () => {
    expect(readInstructions("1,000 litres of lactose-free milk by Monday")).toEqual({
      rest: "1,000 litres of lactose-free milk by Monday",
      budget: undefined,
      waitForPerson: false,
    });
  });

  it("takes neither the budget nor the instruction as the quantity or the product", () => {
    const parsed = parseRequest("milk by Monday under 50 euros, ask me first", NOW);
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.phrase).toBe("milk");
    expect(parsed).toMatchObject({ budget: 50, waitForPerson: true });
  });

  it("keeps what the goods are for apart from the product", () => {
    const parsed = parseRequest("400 litres of lactose-free milk for the breakfast buffets", NOW);
    expect(parsed.phrase).toBe("lactose-free milk");
    expect(parsed.purpose).toBe("breakfast buffets");
  });
});
