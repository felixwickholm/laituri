import type { ProductWords, RoleDef, RoleId } from "./types";

/** Product words reused across roles and recipes. */
export const WORDS = {
  cookingCream: { words: "cooking cream", claims: ["lactose_free"], allergens: ["milk"], kind: "dairy" },
  whippingCream: { words: "whipping cream", claims: ["lactose_free"], allergens: ["milk"], kind: "dairy" },
  milk: { words: "lactose-free milk", allergens: ["milk"], kind: "dairy" },
  oatDrink: { words: "gluten-free oat drink", allergens: ["oats"], kind: "plant" },
  soyDrink: { words: "soy drink", allergens: ["soy"], kind: "plant" },
  butter: { words: "lactose-free butter", nameHas: ["butter"], allergens: ["milk"], kind: "dairy" },
  spread: { words: "vegetable spread", claims: ["vegan"], allergens: [], kind: "plant" },
  oil: { words: "rapeseed oil", allergens: [], kind: "plant" },
  eggs: { words: "eggs", allergens: ["egg"], kind: "egg" },
  wheatFlour: { words: "wheat flour", nameHas: ["wheat flour"], allergens: ["gluten", "wheat"], kind: "plant" },
  gramFlour: { words: "gram flour", allergens: [], kind: "plant" },
  fusilli: { words: "fusilli", nameHas: ["fusilli"], allergens: ["gluten", "wheat"], kind: "plant" },
  macaroni: { words: "macaroni", nameHas: ["macaroni"], allergens: ["gluten", "wheat"], kind: "plant" },
  lasagne: { words: "lasagne", allergens: ["gluten", "wheat"], kind: "plant" },
  rice: { words: "rice", allergens: [], kind: "plant" },
  potatoes: { words: "potatoes", allergens: [], kind: "plant" },
  flatbread: { words: "potato flatbread", allergens: ["gluten", "rye", "wheat"], kind: "plant" },
  ciabatta: { words: "ciabatta", allergens: ["barley", "gluten", "wheat"], kind: "plant" },
  pita: { words: "pita bread", allergens: ["gluten", "wheat"], kind: "plant" },
  oatFlakes: { words: "oat flakes", allergens: ["gluten", "oats"], kind: "plant" },
  gfOatFlakes: { words: "gluten-free oat flakes", allergens: ["oats"], kind: "plant" },
  beefMince: { words: "beef mince", nameHas: ["beef"], allergens: [], kind: "meat" },
  lambMince: { words: "lamb mince", allergens: [], kind: "meat" },
  pikePerch: { words: "pike-perch fillet", nameHas: ["pike"], allergens: ["fish"], kind: "fish" },
  cod: { words: "cod fillet", nameHas: ["cod"], allergens: ["fish"], kind: "fish" },
  saithe: { words: "saithe fillet", nameHas: ["saithe"], allergens: ["fish"], kind: "fish" },
  salmon: { words: "salmon fillet", nameHas: ["salmon fillet c"], allergens: ["fish"], kind: "fish" },
  smokedSalmon: { words: "smoked salmon", allergens: ["fish"], kind: "fish" },
  marinatedSalmon: { words: "marinated salmon", allergens: ["fish"], kind: "fish" },
  chickenFillet: { words: "chicken fillet", allergens: [], kind: "meat" },
  chickenThigh: { words: "chicken thigh", allergens: [], kind: "meat" },
  gratedCheese: { words: "grated cheese", claims: ["lactose_free"], allergens: ["milk"], kind: "dairy" },
  edam: { words: "edam", nameHas: ["edam"], allergens: ["milk"], kind: "dairy" },
  creamCheese: { words: "cream cheese", claims: ["lactose_free"], allergens: ["milk"], kind: "dairy" },
  goatCheese: { words: "goat cheese", allergens: ["lactose", "milk"], kind: "dairy" },
  mascarpone: { words: "mascarpone", allergens: ["lactose", "milk"], kind: "dairy" },
  yoghurt: { words: "natural yoghurt", claims: ["lactose_free"], allergens: ["milk"], kind: "dairy" },
  soyYoghurt: { words: "soy yoghurt", allergens: ["soy"], kind: "plant" },
  fruitYoghurt: { words: "fruit yoghurt", allergens: ["milk"], kind: "dairy" },
  smetana: { words: "smetana", nameHas: ["smetana"], allergens: ["milk"], kind: "dairy" },
  cremeFraiche: { words: "creme fraiche", nameHas: ["crème fraiche"], allergens: ["milk"], kind: "dairy" },
  oatFraiche: { words: "creme fraiche", claims: ["vegan"], allergens: ["oats"], kind: "plant" },
  quark: { words: "quark", claims: ["lactose_free"], nameHas: ["5 kg"], allergens: ["milk"], kind: "dairy" },
  sugar: { words: "sugar", nameHas: ["caster"], allergens: [], kind: "plant" },
  brownSugar: { words: "brown sugar", allergens: [], kind: "plant" },
  tomatoes: { words: "tomatoes", nameHas: ["tomato"], allergens: [], kind: "plant" },
  plumTomatoes: { words: "plum tomatoes", allergens: [], kind: "plant" },
  cherryTomatoes: { words: "cherry tomatoes", allergens: [], kind: "plant" },
  onions: { words: "onions", allergens: [], kind: "plant" },
  redOnion: { words: "red onion", allergens: [], kind: "plant" },
  carrots: { words: "carrots", allergens: [], kind: "plant" },
  coffee: { words: "coffee", allergens: [], kind: "plant" },
  tea: { words: "black tea", allergens: [], kind: "plant" },
} satisfies Record<string, ProductWords>;

/**
 * What may stand in for each culinary role, and what it changes. A swap is used only when the product is short,
 * missing, too late, or breaks an allergen rule or a dietary need, and it is always returned with its reason.
 */
export const ROLES: Record<RoleId, RoleDef> = {
  cream_sauce: {
    label: "cream in a sauce or soup",
    swaps: [
      { ...WORDS.oatFraiche, change: "Oat fraiche works in this sauce. The taste is a little lighter." },
      { ...WORDS.whippingCream, change: "Whipping cream works. Use a little less: it is richer." },
    ],
  },
  whipped_cream: {
    label: "whipped cream",
    swaps: [],
    noSwap: "No swap: no plant cream in the catalogue whips well.",
  },
  milk_liquid: {
    label: "milk as the liquid",
    swaps: [
      { ...WORDS.oatDrink, change: "Oat drink works here. The taste is a little sweeter." },
      { ...WORDS.soyDrink, change: "Soy drink works here. The taste is a little nutty." },
    ],
  },
  plant_milk: {
    label: "plant drink as the liquid",
    swaps: [{ ...WORDS.soyDrink, change: "Soy drink works here. It is a little thicker." }],
  },
  butter_fat: {
    label: "butter for frying or richness",
    swaps: [
      { ...WORDS.spread, change: "Plant spread works for frying and mash. Less buttery taste." },
      { ...WORDS.oil, change: "Rapeseed oil works for frying. Less buttery taste." },
    ],
  },
  frying_oil: {
    label: "oil for frying",
    swaps: [{ ...WORDS.spread, change: "Plant spread works for frying. Use the same amount." }],
  },
  egg_binder: {
    label: "egg that binds the mix",
    swaps: [{ ...WORDS.gramFlour, change: "Gram flour and water bind the mix. A little denser." }],
  },
  egg_structure: { label: "egg that makes the sponge rise", swaps: [], noSwap: "No swap: the sponge needs eggs to rise." },
  egg_white: { label: "egg white whisked to a foam", swaps: [], noSwap: "No swap: the meringue needs egg white." },
  egg_main: { label: "egg as the dish itself", swaps: [], noSwap: "No swap: eggs are the dish." },
  wheat_structure: { label: "flour that holds the sponge", swaps: [], noSwap: "No swap: the sponge needs wheat flour." },
  wheat_dough: { label: "flour that makes the dough", swaps: [], noSwap: "No swap: the dough needs wheat flour." },
  wheat_thickener: {
    label: "flour that thickens the sauce",
    swaps: [{ ...WORDS.gramFlour, change: "Gram flour thickens the sauce. The taste is a little nutty." }],
  },
  pasta_base: {
    label: "pasta under the sauce",
    swaps: [
      { ...WORDS.rice, change: "Rice works with this sauce. Serve it on the side." },
      { ...WORDS.potatoes, change: "Boiled potatoes work with this sauce instead of pasta." },
    ],
  },
  starch_side: {
    label: "the starch on the plate",
    swaps: [
      { ...WORDS.rice, change: "Rice works instead of potatoes. Cook it while the main bakes." },
      { ...WORDS.potatoes, change: "Potatoes work instead of rice. Boil them in salted water." },
    ],
  },
  rice_base: { label: "rice that is the dish", swaps: [], noSwap: "No swap: the dish is the rice." },
  bread_base: {
    label: "bread under the topping",
    swaps: [{ ...WORDS.potatoes, change: "Serve it on boiled potato slices. No gluten that way." }],
  },
  oat_base: {
    label: "oats that make the dish",
    swaps: [{ ...WORDS.gfOatFlakes, change: "Gluten-free oat flakes cook the same way." }],
  },
  beef_protein: {
    label: "minced meat",
    swaps: [{ ...WORDS.lambMince, change: "Lamb mince works. The taste is stronger." }],
  },
  white_fish: {
    label: "white fish fillet",
    swaps: [
      { ...WORDS.cod, change: "Cod works. It is softer, so bake it a little shorter." },
      { ...WORDS.saithe, change: "Saithe works. It is firmer and costs less." },
    ],
  },
  salmon_main: {
    label: "salmon fillet",
    swaps: [{ ...WORDS.pikePerch, change: "Pike-perch works. It is lighter and less fatty." }],
  },
  cured_fish: {
    label: "cured fish on top",
    swaps: [{ ...WORDS.marinatedSalmon, change: "Marinated salmon works. It is a little sweeter." }],
  },
  chicken: {
    label: "chicken",
    swaps: [{ ...WORDS.chickenThigh, change: "Chicken thigh works. It is juicier and costs less." }],
  },
  cheese_topping: {
    label: "cheese on top",
    swaps: [{ ...WORDS.edam, change: "Edam slices work on top. Melts a little less." }],
    canOmit: "Leave the cheese out. The dish is less rich.",
  },
  soft_cheese: {
    label: "soft cheese",
    swaps: [{ ...WORDS.creamCheese, change: "Lactose-free cream cheese works. Milder taste." }],
  },
  yoghurt_base: {
    label: "yoghurt in a sauce or bowl",
    swaps: [{ ...WORDS.soyYoghurt, change: "Soy yoghurt works. It is a little tarter." }],
  },
  sour_cream: {
    label: "sour cream on top",
    swaps: [
      { ...WORDS.oatFraiche, change: "Oat fraiche works on top. The taste is milder." },
      { ...WORDS.yoghurt, change: "Thick yoghurt works on top. A little thinner." },
    ],
  },
  fruit_layer: {
    label: "fruit layer",
    swaps: [{ ...WORDS.soyYoghurt, change: "Soy yoghurt with a little sugar works. Less fruit taste." }],
  },
  quark_body: {
    label: "quark that gives body",
    swaps: [
      { ...WORDS.yoghurt, change: "Thick yoghurt works. The filling is a little softer." },
      { ...WORDS.soyYoghurt, change: "Soy yoghurt works. The filling is softer and tarter." },
    ],
  },
  sugar_sweet: {
    label: "sugar",
    swaps: [{ ...WORDS.brownSugar, change: "Brown sugar works. A light caramel taste." }],
  },
  tomato_base: {
    label: "tomatoes",
    swaps: [
      { ...WORDS.plumTomatoes, change: "Plum tomatoes work. They cook down faster." },
      { ...WORDS.cherryTomatoes, change: "Cherry tomatoes work. Sweeter, and more work to cut." },
    ],
  },
  aromatic_onion: {
    label: "onion for flavour",
    swaps: [{ ...WORDS.redOnion, change: "Red onion works. A little sweeter." }],
  },
  root_veg: {
    label: "root vegetables",
    swaps: [{ ...WORDS.potatoes, change: "More potato works instead. Less colour and sweetness." }],
  },
  potato_body: {
    label: "potatoes that make the dish",
    swaps: [],
    noSwap: "No swap: the dish is built on potatoes.",
  },
  gram_batter: { label: "gram flour batter", swaps: [], noSwap: "No swap: the pancake is gram flour." },
  coffee: { label: "coffee", swaps: [], noSwap: "No swap for coffee." },
  tea: { label: "tea", swaps: [], noSwap: "No swap for tea." },
  as_written: { label: "the ingredient as the recipe writes it", swaps: [], noSwap: "No swap: a person picks a stand-in for this ingredient." },
};
