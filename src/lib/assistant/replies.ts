import type { AssistantLanguage, MenuOption } from "@/lib/contracts";
import { TIER_LABEL } from "./cards";

/** Every sentence the assistant says, in Finnish and English. Facts are filled in from the planner, never written. */

export const TIER_FI: Record<MenuOption["tier"], string> = { good: "Edullinen", better: "Klassinen", best: "Juhlava" };
const FI_WEEKDAY = ["sunnuntaina", "maanantaina", "tiistaina", "keskiviikkona", "torstaina", "perjantaina", "lauantaina"];
const EN_WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string): { weekday: number; day: number; month: number } {
  const at = new Date(`${date}T12:00:00Z`);
  return { weekday: at.getUTCDay(), day: at.getUTCDate(), month: at.getUTCMonth() };
}

/** "lauantaina 21.11." / "Saturday 21 Nov". The Finnish date ends in a period: a sentence must not add another. */
export function spokenDate(date: string, language: AssistantLanguage): string {
  const { weekday, day, month } = parts(date);
  return language === "fi" ? `${FI_WEEKDAY[weekday]} ${day}.${month + 1}.` : `${EN_WEEKDAY[weekday]} ${day} ${EN_MONTH[month]}`;
}

/** 12.4 -> "12,40 €" / "€12.40" */
export function euros(value: number, language: AssistantLanguage): string {
  const fixed = value.toFixed(2);
  return language === "fi" ? `${fixed.replace(".", ",")}\u00a0€` : `€${fixed}`;
}

export function menuName(option: MenuOption, language: AssistantLanguage): string {
  if (language === "en") return `${TIER_LABEL[option.tier]} (${option.name.toLowerCase()})`;
  const kind = option.id.split(":")[1];
  const fi = kind === "buffet" ? "noutopöytä" : kind === "two_course" ? "kahden ruokalajin menu" : "kolmen ruokalajin menu";
  return `${TIER_FI[option.tier]} ${fi}`;
}

const DIET_FI: Record<string, string> = {
  gluten_free: "gluteeniton", lactose_free: "laktoositon", milk_free: "maidoton", nut_free: "pähkinätön", peanut_free: "maapähkinätön",
  egg_free: "munaton", fish_free: "kalaton", sesame_free: "seesamiton", soy_free: "soijaton", vegan: "vegaaninen", vegetarian: "kasvis",
};
const DIET_EN: Record<string, string> = {
  gluten_free: "gluten-free", lactose_free: "lactose-free", milk_free: "milk-free", nut_free: "nut-free", peanut_free: "peanut-free",
  egg_free: "egg-free", fish_free: "fish-free", sesame_free: "sesame-free", soy_free: "soy-free", vegan: "vegan", vegetarian: "vegetarian",
};

export function dietWords(dietary: string[], language: AssistantLanguage): string {
  const table = language === "fi" ? DIET_FI : DIET_EN;
  return dietary.map((need) => table[need] ?? need).join(", ");
}

type Say = Record<AssistantLanguage, string>;

export const SAY = {
  welcome: { fi: "Kerro tapahtumasta: mikä juhla, montako vierasta ja milloin.", en: "Tell me about the event: what it is, how many guests and when." } as Say,
  askGuestsAndDate: { fi: "Montako vierasta, ja minä päivänä?", en: "How many guests, and on which day?" } as Say,
  askGuests: { fi: "Montako vierasta tulee?", en: "How many guests are coming?" } as Say,
  askDate: { fi: "Minä päivänä tapahtuma on?", en: "Which day is the event?" } as Say,
  askDiets: { fi: "Onko vierailla allergioita tai erityisruokavalioita?", en: "Any allergies or special diets?" } as Say,
  noMenus: { fi: "Näillä tiedoilla ei löytynyt sopivaa menua. Muuta jotain tietoa.", en: "No menu fits these details yet. Change one detail." } as Say,
  noMain: {
    fi: "Yhdessäkään menussa ei ole sääntöjesi mukaista pääruokaa. Muuta jotain tietoa.",
    en: "No menu has a main course that fits your rules. Change one detail.",
  } as Say,
  askWhich: { fi: "Minkä menun tilaan: edullisen, klassisen vai juhlavan?", en: "Which menu shall I order: Simple, Classic or Special?" } as Say,
  nothingToOrder: { fi: "Keittiössä on jo kaikki tarvittava. Tilattavaa ei ole.", en: "Your kitchen has everything already. Nothing to order." } as Say,
  human: {
    fi: "Valio Aimon myyjä vastaa arkisin. Paina tilauksen riviltä 'Kysy Valio Aimolta'.",
    en: "A Valio Aimo person answers on working days. Press 'Ask Valio Aimo' on any order line.",
  } as Say,
  thanks: { fi: "Ole hyvä. Onnistunutta tapahtumaa!", en: "You're welcome. Have a great event!" } as Say,
  noRecipe: { fi: "En löytänyt sopivaa reseptiä. Kokeile toista sanaa.", en: "I found no recipe for that. Try another word." } as Say,
  ideasIntro: { fi: "Tässä muutama idea. Kerro vieraiden määrä, niin teen menun.", en: "Here are a few ideas. Tell me the guest count and I'll plan a menu." } as Say,
  reset: { fi: "Aloitetaan alusta.", en: "Let's start over." } as Say,
};

/** Ends a sentence once: "21.11." already ends in a period. */
function sentence(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * The cost per guest as said aloud. With items the planner could not price, it says so in the same breath, so the
 * number is never taken for the full food cost: "€1.63 per guest, not counting 8 items without a price".
 */
function perGuest(option: MenuOption, language: AssistantLanguage): string {
  const price = euros(option.costPerGuest, language);
  const missing = option.unpriced ?? 0;
  if (language === "fi") return missing ? `${price} vieraalta ilman ${missing === 1 ? "yhtä" : missing} hinnatonta tuotetta` : `${price} vieraalta`;
  return missing ? `${price} per guest, not counting ${missing} ${missing === 1 ? "item" : "items"} without a price` : `${price} per guest`;
}

export function menusReady(count: number, guests: number, date: string, dietary: string[], recommended: MenuOption, language: AssistantLanguage): string {
  const diets = dietary.length ? `, ${dietWords(dietary, language)}` : "";
  return language === "fi"
    ? `${sentence(`${count} menua ${guests} vieraalle ${spokenDate(date, language)}${diets}`)} Suosittelen: ${menuName(recommended, language)}, ${perGuest(recommended, language)}.`
    : `${count} menus for ${guests} guests on ${spokenDate(date, language)}${diets}. I suggest the ${menuName(recommended, language)} at ${perGuest(recommended, language)}.`;
}

export function chosen(option: MenuOption, lines: number, language: AssistantLanguage): string {
  return language === "fi"
    ? `${menuName(option, language)}, ${perGuest(option, language)}. Ostoslistalla ${lines} riviä. Tilaanko?`
    : `The ${menuName(option, language)}, ${perGuest(option, language)}. ${lines} lines to order. Shall I order it?`;
}

export function ordering(option: MenuOption, lines: number, language: AssistantLanguage): string {
  return language === "fi"
    ? `Tilaan: ${menuName(option, language)}, ${lines} riviä. Näet tilanteen alta.`
    : `Ordering the ${menuName(option, language)}: ${lines} lines. Watch it below.`;
}

export function recipesFound(count: number, language: AssistantLanguage): string {
  return language === "fi" ? `Löysin ${count} ${count === 1 ? "reseptin" : "reseptiä"}.` : `I found ${count} ${count === 1 ? "recipe" : "recipes"}.`;
}

export function guestsChanged(from: number, to: number, language: AssistantLanguage): string {
  return language === "fi" ? `Päivitin ${from} vieraasta ${to} vieraaseen.` : `Updated from ${from} to ${to} guests.`;
}
