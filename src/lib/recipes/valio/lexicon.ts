import type { Course, KitchenUnit } from "@/lib/contracts";
import { WORDS } from "../roles";
import type { FoodKind, ProductWords, RoleId } from "../types";

type WordKey = keyof typeof WORDS;

/** One Finnish ingredient name and the kitchen ingredient it is. */
export interface LexiconEntry {
  match: RegExp;
  /** A known kitchen ingredient; absent with `none`. */
  key?: WordKey;
  /** Words for an ingredient that WORDS does not hold. */
  words?: ProductWords;
  unit: KitchenUnit;
  role: RoleId;
  /** The role in a dessert or bake, when it differs. */
  sweetRole?: RoleId;
  /** The role in a yeast dough (pizza, bread, pulla, pie), when it differs: it holds the dish together. */
  doughRole?: RoleId;
  /** A close stand-in rather than the same thing (rainbow trout for salmon): the match is medium. */
  close?: true;
  /** Known, and known not to be in the recorded catalogue. */
  none?: true;
}

/**
 * Pasta as a word of its own or after a pasta kind ("perhospastaa", "tuorepastaa"). Anchored: Finnish "pasta" is also
 * a paste, so "sitruunapastaa" (lemon paste) or "currypasta" is not pasta.
 */
const PASTA = /(?:^|[\s,(-])(?:perhos|kierre|tuore|täysjyvä|kuori|putki|nauha|lehti|simpukka|gluteeniton |kuiva)?pasta(?:a|n)?\b|spagetti|penne/;

const RYE_FLOUR: ProductWords = { words: "rye flour", nameHas: ["rye flour"], allergens: ["gluten", "rye"], kind: "plant" };
const BUTTERMILK: ProductWords = { words: "sour milk", nameHas: ["sour milk"], allergens: ["milk"], kind: "dairy" };

/**
 * Finnish ingredient names as Valio writes them, first match wins. Liquids are written in kg on the pages and taken as
 * litres one to one (milk and cream weigh about a kilo a litre).
 */
export const LEXICON: LexiconEntry[] = [
  { match: /maitojauhe|kookosmaito|voiwiener|vaniljakastike|kreemijauhe|maitorahkaa? ?.*täyte|juustotäyte|kinuskitäyte|sulatejuust|valio aura|aura®|raejuust|salaattijuust|feta|halloumi|burrata/, unit: "kg", role: "as_written", none: true },
  { match: /vispikerma|kuohukerma|suurtalous kuohu/, key: "whippingCream", unit: "l", role: "cream_sauce", sweetRole: "whipped_cream" },
  { match: /ruokakerma|ruoka 15|kevytkerma|kermaa/, key: "cookingCream", unit: "l", role: "cream_sauce" },
  { match: /crème fraîche|creme fraiche|crème fraiche/, key: "cremeFraiche", unit: "kg", role: "sour_cream" },
  { match: /smetana|kermaviili/, key: "smetana", unit: "kg", role: "sour_cream" },
  { match: /maitorahka|rahkaa/, key: "quark", unit: "kg", role: "quark_body" },
  { match: /turkkilai\S* ruokajogurt|ruokajogurt|maustamatonta jogurt|turkkilai\S* jogurt/, key: "yoghurt", unit: "kg", role: "yoghurt_base" },
  { match: /mascarpone/, key: "mascarpone", unit: "kg", role: "soft_cheese" },
  { match: /vuohenjuust/, key: "goatCheese", unit: "kg", role: "soft_cheese" },
  { match: /tuorejuust|viola/, key: "creamCheese", unit: "kg", role: "soft_cheese" },
  { match: /edam/, key: "edam", unit: "kg", role: "cheese_topping" },
  { match: /mozzarella|emmental|juustoraaste|pizzajuusto|fontal|parmesaan|cheddar/, key: "gratedCheese", unit: "kg", role: "cheese_topping", close: true },
  { match: /piimä/, words: BUTTERMILK, unit: "l", role: "milk_liquid" },
  { match: /maitojuoma|täysmaito|kevytmaito|rasvaton maito|maitoa|^valio maito/, key: "milk", unit: "l", role: "milk_liquid" },
  { match: /kaurajuoma/, key: "oatDrink", unit: "l", role: "plant_milk" },
  { match: /soijajuoma/, key: "soyDrink", unit: "l", role: "plant_milk" },
  { match: /oivariini/, key: "butter", unit: "kg", role: "butter_fat", close: true },
  { match: /\bvoita|\bvoi\b|kaulintavoi|voisulaa|voin\b/, key: "butter", unit: "kg", role: "butter_fat" },
  { match: /margariini|levitett|kasvirasva/, key: "spread", unit: "kg", role: "butter_fat" },
  { match: /oliiviöljy|seesamiöljy/, unit: "l", role: "frying_oil", none: true },
  { match: /rypsiöljy|ruokaöljy|öljyä|öljy\b/, key: "oil", unit: "l", role: "frying_oil" },
  { match: /kananmun|munamassa|kokomuna|kananmuna/, key: "eggs", unit: "kg", role: "egg_binder", sweetRole: "egg_structure" },
  { match: /vehnäjauho/, key: "wheatFlour", unit: "kg", role: "wheat_thickener", sweetRole: "wheat_structure", doughRole: "wheat_dough" },
  { match: /ruisjauho/, words: RYE_FLOUR, unit: "kg", role: "as_written" },
  { match: /kikhernejauho/, key: "gramFlour", unit: "kg", role: "gram_batter" },
  { match: /fariinisokeri|ruskea sokeri/, key: "brownSugar", unit: "kg", role: "sugar_sweet" },
  { match: /vaniljasokeri|siirappi|hunaja|hillosokeri/, unit: "kg", role: "sugar_sweet", none: true },
  { match: /^(hienoa |)sokeria$|^sokeri$|tomusokeri|^hienoa sokeria/, key: "sugar", unit: "kg", role: "sugar_sweet" },
  { match: /gluteenittomia kaurahiutale/, key: "gfOatFlakes", unit: "kg", role: "oat_base" },
  { match: /kaurahiutale/, key: "oatFlakes", unit: "kg", role: "oat_base" },
  { match: /puuroriisi|riisiä|^riisi/, key: "rice", unit: "kg", role: "starch_side" },
  { match: /lasagne/, key: "lasagne", unit: "kg", role: "pasta_base" },
  { match: /makaroni/, key: "macaroni", unit: "kg", role: "pasta_base" },
  { match: /kierrepasta|fusilli/, key: "fusilli", unit: "kg", role: "pasta_base" },
  { match: PASTA, key: "fusilli", unit: "kg", role: "pasta_base", close: true },
  { match: /perunajauho|perunasose|perunasuikale|perunanuudel|perunataikina|ranskalai/, unit: "kg", role: "as_written", none: true },
  { match: /peruna-sipulisekoitus/, key: "potatoes", unit: "kg", role: "potato_body", close: true },
  { match: /peruna|puikula/, key: "potatoes", unit: "kg", role: "potato_body" },
  { match: /porkkanasose|porkkanapyre/, unit: "kg", role: "as_written", none: true },
  { match: /porkkana/, key: "carrots", unit: "kg", role: "root_veg" },
  { match: /punasipuli|punainen sipuli/, key: "redOnion", unit: "kg", role: "aromatic_onion" },
  { match: /valkosipuli|ruohosipuli|kevätsipuli|purjo/, unit: "kg", role: "aromatic_onion", none: true },
  { match: /pakastesipuli|sipulikuutio/, key: "onions", unit: "kg", role: "aromatic_onion", close: true },
  { match: /sipuli/, key: "onions", unit: "kg", role: "aromatic_onion" },
  { match: /kirsikkatomaat/, key: "cherryTomatoes", unit: "kg", role: "tomato_base" },
  { match: /tomaattimurska|tomaattikastike|tomaattipyre|tomaattisose|säilyketomaat/, key: "plumTomatoes", unit: "kg", role: "tomato_base", close: true },
  { match: /aurinkokuiva/, unit: "kg", role: "tomato_base", none: true },
  { match: /tomaat/, key: "tomatoes", unit: "kg", role: "tomato_base" },
  { match: /mifu|jauhis|delikaura|härkis|nyhtökaura|gold ?& ?green|kasvipohjai/, unit: "kg", role: "as_written", none: true },
  { match: /lampaan/, key: "lambMince", unit: "kg", role: "beef_protein", close: true },
  { match: /kypsää naudan jauheliha|kypsää jauheliha/, key: "beefMince", unit: "kg", role: "beef_protein", close: true },
  { match: /jauheliha/, key: "beefMince", unit: "kg", role: "beef_protein" },
  { match: /broilerin reisi|kanan reisi/, key: "chickenThigh", unit: "kg", role: "chicken" },
  { match: /marinoimattomia broilerin rintafilee|broilerin rintafilee(?!.*kypsä)|broilerifilee(?!.*kypsä)|broilerin filee/, key: "chickenFillet", unit: "kg", role: "chicken" },
  { match: /broiler|kanafilee/, key: "chickenFillet", unit: "kg", role: "chicken", close: true },
  { match: /kylmäsavu.*(lohi|lohta)|savulohi|lämminsavulohi|lämminsavulohta|kylmäsavulohi/, key: "smokedSalmon", unit: "kg", role: "cured_fish" },
  { match: /graavi/, key: "marinatedSalmon", unit: "kg", role: "cured_fish" },
  { match: /kylmäsavu.*kirjolohi/, key: "smokedSalmon", unit: "kg", role: "cured_fish", close: true },
  { match: /kirjolohi/, key: "salmon", unit: "kg", role: "salmon_main", close: true },
  { match: /lohen nahka|kirjolohimassa/, unit: "kg", role: "as_written", none: true },
  { match: /lohifilee|lohta\b|^lohi|lohen filee|lohikuutio/, key: "salmon", unit: "kg", role: "salmon_main" },
  { match: /kuha/, key: "pikePerch", unit: "kg", role: "white_fish" },
  { match: /turska/, key: "cod", unit: "kg", role: "white_fish" },
  { match: /seiti/, key: "saithe", unit: "kg", role: "white_fish" },
  { match: /annoskalapal|kalafilee/, key: "saithe", unit: "kg", role: "white_fish", close: true },
  { match: /pitaleipä/, key: "pita", unit: "kg", role: "bread_base" },
  { match: /ciabatta/, key: "ciabatta", unit: "kg", role: "bread_base" },
  { match: /perunarieska|rieska/, key: "flatbread", unit: "kg", role: "bread_base" },
  { match: /^kahvi|kahvia/, key: "coffee", unit: "kg", role: "coffee" },
];

/**
 * Kitchen basics: water, salt, pepper, herbs, spices, raising agents and stock. The kitchen has them, so nothing is
 * ordered; they still count for allergens and for vegetarian menus.
 */
export const BASICS =
  /^(vettä|vesi|jäävettä|kylmää vettä|kiehuvaa vettä)|suola|pippur|basilika|oregano|timjami|tilli|persilja|ruohosipuli|korianteri|rosmariini|meirami|laakerinlehti|muskotti|kaneli|kardemumma|neilikka|inkivää|curry|chili(jauhe|ä)|paprikajauhe|kumina|anis|vanilja(?!kastike)|leivinjauhe|ruokasooda|hiiva|kirveli|rakuuna|lipstikka|katajanmarja|yrtti|liemi|lientä|fondi|piparkakkumauste|maustepippur|maustese|lehtipersilja|sitruunankuor|valkosipulimurska/;

/** Allergen ids the catalogue uses, read from the Finnish name as written. */
const ALLERGEN_WORDS: [RegExp, string[]][] = [
  [/maito|kerma|\bvoi|voita|voin\b|juust|rahka|jogurt|smetana|crème|creme|kermaviil|piimä|oivariini|valio aura|aura®|mozzarella|emmental|fontal|parmesaan|mascarpone|kinuski|vaniljakastike|kreemijauhe|suklaa|wiener|curd|hehku|tuorejuust|viola|pomada|halloumi|feta|burrata/, ["milk"]],
  [PASTA, ["gluten", "wheat"]],
  [/vehnä|lasagne|makaroni|spagetti|penne|leipä|leivän|korppu|ciabatta|pita|tortilla|taikina|kakkupohja|wiener|croissant|keksi|muroja|muro\b|nuudeli|worcester|suuruste|vetopohja|pizzapohja|pinsa|sämpylä|bulgur|couscous|seitan|rieska|tummaleipä|leipämix|piirakka|hapankorppu|ruiskiekko|rouhepala|ruispala|ruisleip|ohukai|pannukak/, ["gluten", "wheat"]],
  [/ruis/, ["gluten", "rye"]],
  [/ohra|mallas/, ["gluten", "barley"]],
  [/kaura|delikaura|nyhtökaura/, ["oats"]],
  [/muna|munia|munan|majoneesi|marenki|caesarkastike|tuulihattu|curd|ohukai|pannukak|kakkupohja|vetopohja|letu|blini/, ["egg"]],
  [/lohi|lohta|lohen|kala|silakka|silli|kuha|turska|seiti|muikku|anjovis|tonnikala|kirjolohi/, ["fish"]],
  [/katkarap|rapu|ravun|hummeri/, ["crustaceans"]],
  [/simpuk|osteri/, ["molluscs"]],
  [/pähkinä|cashew|pekaani|pistaasi|pinjansiemen|nougat|praliini|saksanpähkinä/, ["nuts"]],
  [/manteli|marsipaani/, ["nuts", "almond"]],
  [/maapähkinä/, ["peanut"]],
  [/seesami|tahini|halva/, ["sesame"]],
  [/soija|tofu|edamame/, ["soy"]],
  [/selleri/, ["celery"]],
  [/sinappi|sinapin|dijon/, ["mustard"]],
  [/viini|siideri/, ["sulphites"]],
];

const GLUTEN_FREE = /gluteeniton|gluteenittom/;
const LACTOSE_FREE = /laktoositon|laktoosittom|eila|lactose free/;

/** Allergens the ingredient brings, read from its Finnish name; milk sugar unless it says lactose-free. */
export function allergensOf(name: string, recipeLactoseFree: boolean): string[] {
  const found = new Set<string>();
  for (const [pattern, ids] of ALLERGEN_WORDS) if (pattern.test(name)) ids.forEach((id) => found.add(id));
  if (GLUTEN_FREE.test(name)) ["gluten", "wheat", "rye", "barley"].forEach((id) => found.delete(id));
  if (found.has("oats") && !GLUTEN_FREE.test(name) && /hiutale|kaurajauho|kaurainen|kaurais/.test(name)) found.add("gluten");
  if (found.has("milk") && !LACTOSE_FREE.test(name) && !recipeLactoseFree) found.add("lactose");
  return [...found].sort();
}

/** What kind of food the ingredient is, for vegetarian and vegan menus. Gelatine and meat stock count as meat. */
export function kindOf(name: string, allergens: string[]): FoodKind {
  if (/muna|munia|munan|majoneesi|marenki/.test(name) && !/broiler|liha/.test(name)) return "egg";
  if (/liha|broiler|\bkana|porsa|nauta|naudan|kinkku|pekoni|makkara|kassler|possu|palvi|lammas|lampaan|kalkkuna|riista|poro(a|n|\b)|luita|liivate|gelatiini|kebab|fondi/.test(name) && !/mifu|jauhis|kasvi|kaura|härkis/.test(name)) return "meat";
  if (allergens.includes("fish") || allergens.includes("crustaceans") || allergens.includes("molluscs")) return "fish";
  if (allergens.includes("egg")) return "egg";
  if (allergens.includes("milk")) return "dairy";
  return "plant";
}

export function lexiconEntry(name: string): LexiconEntry | undefined {
  return LEXICON.find((entry) => entry.match.test(name));
}

/** The role this entry plays in a dish of this course; in a yeast dough, its dough role first. */
export function roleIn(entry: LexiconEntry, course: Course, sweet: boolean, dough = false): RoleId {
  if (dough && entry.doughRole) return entry.doughRole;
  return sweet || course === "dessert" ? (entry.sweetRole ?? entry.role) : entry.role;
}
