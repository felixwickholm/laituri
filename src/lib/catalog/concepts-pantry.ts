import type { ConceptDef } from "./lexicon";

/** Oils, dry goods, condiments and drinks. Order matters: the first concept whose rules match a product wins. */
export const PANTRY_CONCEPTS: ConceptDef[] = [
  {
    id: "olive_oil", label: "olive oil", categories: ["1053"],
    terms: ["olive oil", "oliiviöljy", "oliiviöljyä", "olivolja"], include: /(olive|oliivi|oliv)/,
  },
  {
    id: "rapeseed_oil", label: "rapeseed oil", categories: ["1053", "10517"],
    terms: ["rapeseed oil", "canola oil", "cooking oil", "oil", "rypsiöljy", "rypsiöljyä", "rapsiöljy", "öljy", "öljyä", "rapsolja", "olja"],
    include: /(rapeseed|rypsi|raps|canola)/,
  },
  {
    id: "rice", label: "rice", categories: ["21340"],
    terms: ["rice", "riisi", "riisiä", "ris", "basmati", "jasmine rice", "jasmiiniriisi"],
    include: /(rice|riisi|\bris\b|risella|basmati|jasmin)/,
    exclude: /(paper|paperi|wrapper|noodle|nuudeli|pudding|puuro|cake|kakku|flour|jauho|vinegar|etikka|mix|seos|multigrain)/,
  },
  {
    id: "pasta", label: "pasta", categories: ["21380", "17304"],
    terms: ["pasta", "pastaa", "macaroni", "makaroni", "makaronia", "spaghetti", "spagetti", "penne", "fusilli"],
    include: /(pasta|macaroni|makaroni|spag|penne|fusilli|tagliatelle|lasagne|farfalle|rigatoni)/,
  },
  {
    id: "flour", label: "flour", categories: ["21300", "21310", "21320"],
    terms: ["flour", "wheat flour", "jauho", "jauhot", "jauhoja", "vehnäjauho", "vehnäjauhot", "vehnäjauhoja", "mjöl", "vetemjöl"],
    include: /(flour|jauho|mjöl)/, exclude: /(mix|seos|crumb|korppu|pancake|waffle|panko)/,
  },
  {
    id: "oats", label: "oat flakes", categories: ["21370"],
    terms: ["oats", "oat flakes", "rolled oats", "oatmeal", "kaurahiutaleet", "kaurahiutaleita", "havregryn"],
    include: /(oat|kaura|havre)/, exclude: /(bran|lese|biscuit|keksi)/,
  },
  {
    id: "sugar", label: "sugar", categories: ["22100"],
    terms: ["sugar", "sokeri", "sokeria", "hienosokeri", "taloussokeri", "kidesokeri", "socker", "strösocker"], include: /(sugar|sokeri|socker)/, exclude: /(vanil|syrup|siirappi)/,
  },
  { id: "salt", label: "salt", categories: ["22600"], terms: ["salt", "suola", "suolaa", "sea salt", "merisuola"], include: /(salt|suola)/ },
  {
    id: "coffee", label: "coffee", categories: ["22300", "22410", "22411", "22412"],
    terms: ["coffee", "kahvi", "kahvia", "kaffe", "ground coffee", "coffee beans", "espresso"],
    include: /(coffee|kahvi|kaffe|espresso)/, exclude: /(milk|maito|latte|cappuccino|\bice\b)/,
  },
  {
    id: "tea", label: "tea", categories: ["22530", "22531"],
    terms: ["tea", "tee", "teetä", "earl grey", "green tea", "vihreä tee"], include: /(\btea\b|\btee\b|\bte\b|earl grey)/,
  },
  {
    id: "bread", label: "bread", categories: ["10900", "10901", "10902", "41760", "41761"],
    terms: ["bread", "leipä", "leipää", "limppu", "bröd", "rye bread", "ruisleipä", "toast", "paahtoleipä", "sämpylä", "rolls", "baguette"],
    include: /(bread|leipä|limppu|bröd|loaf|baguette|ciabatta|roll|sämpylä|toast|paahto)/, exclude: /(crumb|korppu)/,
  },
  {
    id: "canned_tomato", label: "crushed tomatoes", categories: ["21590"],
    terms: ["crushed tomatoes", "chopped tomatoes", "tomato puree", "tomato paste", "passata", "tomaattimurska", "tomaattimurskaa", "tomaattipyree", "tomaattisose", "krossade tomater"],
    include: /(tomat|tomaatti)/, exclude: /(sun|aurinko|soltork|ketchup|sauce|kastike)/,
  },
  {
    id: "nut_butter", label: "nut butter", categories: ["21453"],
    terms: ["peanut butter", "nut butter", "almond butter", "maapähkinävoi", "maapähkinävoita", "maapähkinätahna", "pähkinävoi", "jordnötssmör"],
    include: /(peanut butter|nut butter|almond butter|maapähkinävoi|maapähkinätahna|pähkinävoi|mantelivoi|jordnötssmör)/,
  },
  { id: "ketchup", label: "ketchup", categories: ["21912"], terms: ["ketchup", "ketsuppi", "ketsuppia"], include: /(ketchup|ketsup)/ },
  { id: "mayonnaise", label: "mayonnaise", categories: ["21910"], terms: ["mayonnaise", "mayo", "majoneesi", "majoneesia", "majonnäs"], include: /(mayo|majonee|majonnä)/ },
  { id: "mustard", label: "mustard", categories: ["22610"], terms: ["mustard", "sinappi", "sinappia", "senap"], include: /(mustard|sinappi|senap)/ },
  {
    id: "orange_juice", label: "orange juice", categories: ["21400", "21401", "21403"],
    terms: ["orange juice", "appelsiinimehu", "appelsiinimehua", "appelsiinituoremehu", "apelsinjuice"],
    include: /(orange|appelsiini|apelsin)/, exclude: /(nectar|lemonade|limonadi|soda|smoothie)/,
  },
  {
    id: "apple_juice", label: "apple juice", categories: ["21400", "21401", "21403"],
    terms: ["apple juice", "omenamehu", "omenamehua", "omenatuoremehu", "äppeljuice"],
    include: /(apple|omena|äpple)/, exclude: /(nectar|smoothie|grape|rypäle|cider|siideri)/,
  },
  {
    id: "mineral_water", label: "mineral water", categories: ["22705", "22706"],
    terms: ["water", "mineral water", "sparkling water", "kivennäisvesi", "vesi", "vettä", "vatten", "mineralvatten"],
    include: /(water|vesi|vatten|vichy)/, exclude: /(rose|ruusu|coconut|kookos|tonic|vitamin)/,
  },
  {
    id: "ice_cream", label: "ice cream", categories: ["418"],
    terms: ["ice cream", "jäätelö", "jäätelöä", "glass"], include: /(ice cream|jäätelö|glass)/,
  },
];
