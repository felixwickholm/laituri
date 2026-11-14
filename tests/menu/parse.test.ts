import { describe, expect, it } from "vitest";
import { readEventWords } from "@/lib/menu";

const TODAY = "2026-11-14";

describe("reading an event from words, by rule", () => {
  it.each([
    ["Dinner for 80 on Friday, no nuts", { guests: 80, date: "2026-11-20", occasion: "dinner", dietary: ["nut_free"] }],
    ["Wedding dinner for 80 on Friday, two guests are coeliac, no nuts", { guests: 80, date: "2026-11-20", occasion: "wedding", dietary: ["nut_free", "gluten_free"] }],
    ["We have a wedding on Saturday with 80 guests. Three courses.", { guests: 80, date: "2026-11-21", occasion: "wedding", courses: 3 }],
    ["Lunch for 120 pupils tomorrow, vegetarian and egg-free", { guests: 120, date: "2026-11-15", occasion: "lunch", dietary: ["egg_free", "vegetarian"] }],
    ["Buffet for 45 people on 2026-12-04, gluten-free and lactose-free", { guests: 45, date: "2026-12-04", occasion: "buffet", dietary: ["gluten_free", "lactose_free"] }],
    ["School lunch, no nuts or sesame", { occasion: "school lunch", dietary: ["nut_free", "sesame_free"] }],
    ["Christmas party for sixty, no peanuts", { guests: 60, occasion: "Christmas party", dietary: ["peanut_free"] }],
  ])("reads English: %s", (words, expected) => {
    expect(readEventWords(words, TODAY)).toEqual({ dietary: [], ...expected });
  });

  it.each([
    ["80 hengen illallinen perjantaina, ei pähkinää", { guests: 80, date: "2026-11-20", occasion: "dinner", dietary: ["nut_free"] }],
    ["Meillä on häät lauantaina, 80 vierasta, kolme ruokalajia", { guests: 80, date: "2026-11-21", occasion: "wedding", courses: 3 }],
    ["Pikkujoulut 4.12. 60 henkeä, gluteeniton ja maidoton", { guests: 60, date: "2026-12-04", occasion: "Christmas party", dietary: ["gluten_free", "milk_free"] }],
    ["Huomenna lounas 30 hengelle, kaksi keliaakikkoa, vegaaninen", { guests: 30, date: "2026-11-15", occasion: "lunch", dietary: ["gluten_free", "vegan"] }],
    ["Ei kalaa eikä kananmunaa, 20 henkeä", { guests: 20, dietary: ["fish_free", "egg_free"] }],
    ["Ei maapähkinää, 25 asiakasta torstaina", { guests: 25, date: "2026-11-19", dietary: ["peanut_free"] }],
  ])("reads Finnish: %s", (words, expected) => {
    expect(readEventWords(words, TODAY)).toMatchObject({ dietary: [], ...expected });
  });

  it("leaves out what the words do not say", () => {
    expect(readEventWords("Something nice", TODAY)).toEqual({ guests: undefined, date: undefined, occasion: undefined, dietary: [], courses: undefined });
  });

  it("reads a Finnish date that has passed this year as next year's", () => {
    expect(readEventWords("Illallinen 20 hengelle 3.1.", TODAY).date).toBe("2027-01-03");
  });

  it("keeps the nut rule when both nuts and peanuts are named", () => {
    expect(readEventWords("Dinner for 10, no peanuts and no nuts", TODAY).dietary).toEqual(["peanut_free", "nut_free"]);
  });

  it.each([
    ["ilman gluteenia 20 henkeä", ["gluten_free"]],
    ["60 hengen illallinen ilman laktoosia", ["lactose_free"]],
    ["Lounas ilman pähkinöitä ja kalaa", ["nut_free", "fish_free"]],
    ["gluteeniton ja laktoositon lounas", ["gluten_free", "lactose_free"]],
    ["pähkinätön jälkiruoka", ["nut_free"]],
    ["munaton, kalaton ja soijaton illallinen", ["egg_free", "fish_free", "soy_free"]],
    ["gluteenittomat ja laktoosittomat annokset", ["gluten_free", "lactose_free"]],
    ["Middag för 30, utan gluten", ["gluten_free"]],
    ["Lunch utan nötter och fisk", ["nut_free", "fish_free"]],
    ["glutenfri och laktosfri buffé", ["gluten_free", "lactose_free"]],
  ])("reads 'without' in Finnish and Swedish: %s", (words, dietary) => {
    expect(readEventWords(words, TODAY).dietary.sort()).toEqual([...dietary].sort());
  });

  it("reads a budget per guest as a budget, never as the guest count", () => {
    expect(readEventWords("budget 15 € per guest", TODAY)).toMatchObject({ guests: undefined, budgetPerGuest: 15 });
    expect(readEventWords("80 guests, budget 15 € per guest", TODAY)).toMatchObject({ guests: 80, budgetPerGuest: 15 });
    expect(readEventWords("40 vierasta, alle 20 euroa hengeltä", TODAY)).toMatchObject({ guests: 40, budgetPerGuest: 20 });
    expect(readEventWords("Häät 60 hengelle, 25 € per henkilö", TODAY)).toMatchObject({ guests: 60, budgetPerGuest: 25 });
    expect(readEventWords("Dinner for 30 at 18 eur per guest", TODAY)).toMatchObject({ guests: 30, budgetPerGuest: 18 });
  });

  it("reads 'tänä perjantaina' as this coming Friday, and 'tänään' as today", () => {
    expect(readEventWords("Pikkujoulut tänä perjantaina 30 hengelle", TODAY).date).toBe("2026-11-20");
    expect(readEventWords("Lounas tänään 30 hengelle", TODAY).date).toBe(TODAY);
    expect(readEventWords("Illallinen tänä iltana 12 hengelle", TODAY).date).toBe(TODAY);
  });

  it.each([
    ["Häät lauantaina 80 ihmiselle", 80],
    ["Hääjuhla 120 vieraalle 5.6.", 120],
    ["Pikkujoulut 40 vieraille", 40],
    ["Illallinen 25 hengelle", 25],
    ["Lounas 50 ihmistä", 50],
  ])("reads the Finnish guest word in %s", (words, guests) => {
    expect(readEventWords(words, TODAY).guests).toBe(guests);
  });
});
