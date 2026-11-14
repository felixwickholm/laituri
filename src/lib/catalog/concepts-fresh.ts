import type { ConceptDef } from "./lexicon";

const DRINK = { amount: 1, unit: "l" } as const;

/** Chilled and fresh foodservice staples. Order matters: the first concept whose rules match a product wins. */
export const FRESH_CONCEPTS: ConceptDef[] = [
  {
    id: "coffee_milk", label: "coffee milk or cream", categories: ["10400", "10401"],
    terms: ["coffee milk", "coffee cream", "kahvimaito", "kahvikerma", "kaffemjölk", "kaffegrädde", "barista milk"],
    include: /(coffee|kahvi|kaffe|café|cafè|barista)/, exclude: /(latte|kahvijuoma|coffee drink|kaffedryck|vanil)/,
  },
  {
    id: "buttermilk", label: "buttermilk", categories: ["10400", "10411", "10419"], typical: DRINK,
    terms: ["buttermilk", "sour milk", "piimä", "piimää", "filmjölk", "surmjölk", "kefir"],
    include: /(piimä|sour ?milk|filmjölk|surmjölk|kefir)/,
  },
  {
    id: "milk", label: "milk", categories: ["10400"], typical: DRINK, fat: true,
    terms: ["milk", "milks", "maito", "maitoa", "maitojuoma", "maitojuomaa", "mjölk", "mjölkdryck", "milk drink", "milkdrink"],
    include: /(milk|maito|mjölk)/,
    exclude: /(coffee|kahvi|kaffe|café|cafè|barista|portion|annos|piimä|sour ?milk|filmjölk|surmjölk|latte|gurt|kefir|choco|kaakao|cocoa|vanil|mansik|strawberr|shake|powder|jauhe)/,
  },
  {
    id: "whipping_cream", label: "whipping cream", categories: ["10401"], fat: true,
    terms: ["whipping cream", "double cream", "heavy cream", "cream", "kuohukerma", "vispikerma", "kerma", "kermaa", "vispgrädde", "grädde"],
    include: /(whipping|kuohu|vispi|vispgrädde|double cream|heavy cream)/,
  },
  {
    id: "cooking_cream", label: "cooking cream", categories: ["10401"],
    terms: ["cooking cream", "ruokakerma", "ruokakermaa", "ruoanvalmistuskerma", "matlagningsgrädde", "matgrädde"],
    include: /(cooking|ruokakerma|ruoanvalmistus|matlagning|matgrädde)/,
  },
  {
    id: "sour_cream", label: "sour cream", categories: ["10419", "10418"],
    terms: ["sour cream", "creme fraiche", "crème fraiche", "smetana", "smetanaa", "ranskankerma", "kermaviili", "gräddfil"],
    include: /(sour cream|smetana|ranskankerma|fraiche|fraîche|kermaviili|gräddfil)/,
  },
  {
    id: "yogurt", label: "yogurt", categories: ["10412", "10413", "10400"], typical: { amount: 1, unit: "kg" }, fat: true,
    terms: ["yogurt", "yoghurt", "yogurts", "jogurtti", "jogurttia", "jogurt", "youghurt"],
    include: /(yog|jogurt|gurt|fermented soya|fermented oat)/,
  },
  { id: "quark", label: "quark", categories: ["10430"], terms: ["quark", "rahka", "rahkaa", "kvarg"], include: /(quark|rahka|kvarg)/ },
  {
    id: "butter", label: "butter", categories: ["10500", "10501"], typical: { amount: 0.5, unit: "kg" },
    terms: ["butter", "voi", "voita", "smör"],
    include: /(butter|\bvoi\b|smör)/, exclude: /(margar|blend|levite|oivariini|flavoured|garlic|valkosipuli)/,
  },
  {
    id: "margarine", label: "margarine", categories: ["10515", "10516", "10517", "10518"],
    terms: ["margarine", "margariini", "margariinia", "margarin", "fat spread", "levite", "rasvaseos"],
    include: /(margar|spread|levite|rasvaseos|fat blend|matfett|leivontarasva)/,
  },
  {
    id: "oat_drink", label: "oat drink", categories: ["10402", "10413"], typical: DRINK,
    terms: ["oat drink", "oat milk", "oatmilk", "kaurajuoma", "kaurajuomaa", "havredryck", "havremjölk"],
    include: /(oat|kaura|havre)/,
    exclude: /(cooking|ruoka|matlag|whip|vispi|gurt|fraiche|fraîche|spread|levite|ice|vanil|choco|kaakao|snack|cream|kerma|grädde|cuisine)/,
  },
  {
    id: "soy_drink", label: "soy drink", categories: ["10402"], typical: DRINK,
    terms: ["soy drink", "soy milk", "soya drink", "soya milk", "soijajuoma", "soijajuomaa", "sojadryck"],
    include: /(soy|soija|soja)/, exclude: /(gurt|dessert|vanil|choco|kaakao|cuisine|cooking|whip)/,
  },
  {
    id: "plant_drink", label: "plant drink", categories: ["10402"], typical: DRINK,
    terms: ["plant drink", "plant milk", "almond drink", "almond milk", "kasvijuoma", "mantelijuoma", "växtdryck"],
    include: /(almond|manteli|mandel|rice drink|riisijuoma|pea drink|hernejuoma)/,
  },
  {
    id: "cottage_cheese", label: "cottage cheese", categories: ["10603"],
    terms: ["cottage cheese", "raejuusto", "raejuustoa", "keso", "grynost"], include: /(cottage|raejuust|keso)/,
  },
  {
    id: "grated_cheese", label: "grated cheese", categories: ["106"],
    terms: ["grated cheese", "shredded cheese", "pizza cheese", "juustoraaste", "juustoraastetta", "pizzajuusto", "riven ost"],
    include: /(grated|shredded|raaste|riven|pizza)/,
  },
  { id: "mozzarella", label: "mozzarella", categories: ["106", "41771"], terms: ["mozzarella", "mozzarellaa", "burrata"], include: /(mozzarella|burrata)/ },
  {
    id: "feta", label: "feta or salad cheese", categories: ["10600", "10636"],
    terms: ["feta", "fetaa", "feta cheese", "salad cheese", "salaattijuusto", "salaattijuustoa", "fetaost", "salladsost"],
    include: /(feta|salad cheese|salaattijuust|white cheese|salladsost)/,
  },
  { id: "halloumi", label: "halloumi", categories: ["10639"], terms: ["halloumi", "grilling cheese", "grillijuusto"], include: /halloumi/ },
  {
    id: "cream_cheese", label: "cream cheese", categories: ["10635", "10633"],
    terms: ["cream cheese", "tuorejuusto", "tuorejuustoa", "färskost", "processed cheese", "sulatejuusto"],
    include: /(cream cheese|tuorejuust|färskost|processed|sulatejuust|smältost|spreadable)/,
  },
  {
    id: "cheese", label: "cheese", categories: ["10600", "10602", "10603"], typical: { amount: 1, unit: "kg" },
    // A variety (cheddar, edam, gouda, emmental) is not a synonym: it stays in the words as a requirement, so
    // "cheddar cheese slices" is never met by edam slices. The include pattern still files those products as cheese.
    terms: ["cheese", "juusto", "juustoa", "ost"],
    include: /(cheese|juusto|\bost\b|edam|gouda|emmental|cheddar)/,
    exclude: /(cottage|raejuust|feta|halloumi|mozzarella|cream cheese|tuorejuust|blue|mould|homejuust)/,
  },
  {
    id: "eggs", label: "eggs", categories: ["10590"],
    terms: ["egg", "eggs", "kananmuna", "kananmunia", "kananmunat", "muna", "munia", "munat", "ägg"],
    include: /(egg|kananmun|\bmun|ägg)/, exclude: /(quail|viiriäi|vaktel)/,
  },
];
