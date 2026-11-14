import type { ConceptDef } from "./lexicon";

const PROCESSED = /(nugget|burger|patty|pihvi|sausage|makkara|nakki|ball|pyörykä|kebab|timbale|soup|keitto|pie\b|piirak|piiras|pasty|coated|breaded|leivitet|kuorrut|chip shop)/;

/** Meat, fish and produce. Order matters: the first concept whose rules match a product wins. */
export const PROTEIN_AND_PRODUCE_CONCEPTS: ConceptDef[] = [
  {
    id: "chicken", label: "chicken", categories: ["18750", "17209", "41710"],
    terms: ["chicken", "kana", "kanaa", "kanan", "broiler", "broileri", "broileria", "broilerin", "kyckling"],
    include: /(chicken|\bkana|broiler|kyckling)/, exclude: PROCESSED,
  },
  {
    id: "minced_meat", label: "minced meat", categories: ["18760", "41704"],
    terms: ["minced meat", "mince", "ground beef", "jauheliha", "jauhelihaa", "köttfärs", "malet kött"],
    include: /(mince|jauheliha|köttfärs|ground beef)/, exclude: /(patty|pihvi|ball|pyörykä|burger)/,
  },
  { id: "bacon", label: "bacon", categories: ["17202", "41701"], terms: ["bacon", "pekoni", "pekonia"], include: /(bacon|pekoni)/ },
  { id: "ham", label: "ham", categories: ["17203"], terms: ["ham", "kinkku", "kinkkua", "skinka", "prosciutto"], include: /(\bham\b|kinkku|skinka|prosciutto)/ },
  {
    id: "sausage", label: "sausage", categories: ["17200", "17201"],
    terms: ["sausage", "sausages", "makkara", "makkaraa", "korv", "frankfurter", "nakki", "nakkeja", "wiener"],
    include: /(sausage|makkara|korv|frankfurt|nakki|wiener)/,
  },
  {
    id: "beef", label: "beef", categories: ["18720", "41702"],
    terms: ["beef", "naudanliha", "naudanlihaa", "nauta", "naudan", "härkä", "nötkött", "entrecote", "sirloin"],
    include: /(beef|nauta|naudan|härkä|nöt|entrecote|sirloin)/, exclude: /(mince|jauhe|kebab)/,
  },
  {
    id: "pork", label: "pork", categories: ["18710", "41701"],
    terms: ["pork", "porsas", "porsaan", "sianliha", "sianlihaa", "possu", "fläsk", "fläskkött"],
    include: /(pork|porsa|\bsika|sian|possu|fläsk|gris)/, exclude: /(mince|jauhe|bacon|pekoni)/,
  },
  {
    id: "rainbow_trout", label: "rainbow trout", categories: ["1870", "4172"],
    terms: ["rainbow trout", "trout", "kirjolohi", "kirjolohta", "regnbåge", "regnbågslax", "taimen"],
    include: /(trout|kirjolohi|regnbåg|taimen)/, exclude: PROCESSED,
  },
  {
    id: "salmon", label: "salmon", categories: ["1870", "4172"],
    terms: ["salmon", "lohi", "lohta", "lohifilee", "lax", "laxfilé"],
    include: /(salmon|\blohi|\blax)/, exclude: PROCESSED,
  },
  {
    id: "white_fish", label: "white fish", categories: ["1870", "4172"],
    terms: ["white fish", "cod", "turska", "turskaa", "torsk", "saithe", "seiti", "hake", "kummeli", "pollock", "pike perch", "kuha", "gös"],
    include: /(\bcod\b|turska|torsk|saithe|seiti|\bsej|hake|kummeli|pollock|pike-perch|kuha|gös)/, exclude: PROCESSED,
  },
  {
    id: "shrimp", label: "shrimp", categories: ["4172", "18703"],
    terms: ["shrimp", "shrimps", "prawn", "prawns", "katkarapu", "katkarapuja", "räkor", "räka"],
    include: /(prawn|shrimp|katkarap|räk)/,
  },
  { id: "tuna", label: "tuna", categories: ["21530"], terms: ["tuna", "tonnikala", "tonnikalaa", "tonfisk"], include: /(tuna|tonnikala|tonfisk)/ },
  { id: "tofu", label: "tofu", categories: ["17306"], terms: ["tofu", "tofua"], include: /tofu/ },
  {
    id: "potatoes", label: "potatoes", categories: ["17421", "17422"],
    terms: ["potato", "potatoes", "peruna", "perunaa", "perunat", "perunoita", "potatis"],
    include: /(potato|peruna|potatis)/, exclude: /(sweet|bataat|salad|salaatti|sallad)/,
  },
  {
    id: "fries", label: "french fries", categories: ["41751"],
    terms: ["fries", "french fries", "ranskalaiset", "ranskanperunat", "pommes frites", "pommes"],
    include: /(fries|ranskalai|pommes|frites)/,
  },
  {
    id: "garlic", label: "garlic", categories: ["17405", "17432"],
    terms: ["garlic", "valkosipuli", "valkosipulia", "vitlök"], include: /(garlic|valkosipuli|vitlök)/,
  },
  {
    id: "onion", label: "onion", categories: ["17405", "17444", "17432"],
    terms: ["onion", "onions", "sipuli", "sipulia", "sipulit", "lök"],
    include: /(onion|sipuli|\blök)/, exclude: /(spring|kevät|garlic|valkosipuli|vitlök|ruohosipuli|chive|purjo|leek|shal)/,
  },
  {
    id: "carrot", label: "carrots", categories: ["17431", "17442", "4173"],
    terms: ["carrot", "carrots", "porkkana", "porkkanaa", "porkkanat", "porkkanoita", "morot", "morötter"],
    include: /(carrot|porkkana|morot|morötter)/, exclude: /(pulp|sose|patty|pihvi|juice|mehu|mix|seos)/,
  },
  { id: "tomato", label: "tomatoes", categories: ["17401"], terms: ["tomato", "tomatoes", "tomaatti", "tomaatteja", "tomaatit", "tomat", "tomater"], include: /(tomat|tomaatti|tomberry)/ },
  {
    id: "cucumber", label: "cucumber", categories: ["17402"],
    terms: ["cucumber", "cucumbers", "kurkku", "kurkkua", "kurkut", "gurka"], include: /(cucumber|kurkku|gurka)/, exclude: /(pickled|suolakurk|inlagd)/,
  },
  {
    id: "lettuce", label: "lettuce", categories: ["17403", "17441"],
    terms: ["lettuce", "salad", "salaatti", "salaattia", "sallad", "iceberg", "jäävuorisalaatti"],
    include: /(lettuce|salaatti|sallad|iceberg|jäävuori|romaine|frisee|frisé)/,
  },
  { id: "apple", label: "apples", categories: ["17412"], terms: ["apple", "apples", "omena", "omenaa", "omenat", "omenoita", "äpple", "äpplen"], include: /(apple|omena|äpple)/ },
  { id: "banana", label: "bananas", categories: ["17413"], terms: ["banana", "bananas", "banaani", "banaania", "banaanit", "banaaneja", "banan", "bananer"], include: /banan/ },
  {
    id: "lemon", label: "lemons", categories: ["17411"],
    terms: ["lemon", "lemons", "sitruuna", "sitruunaa", "sitruunat", "citron", "citroner"], include: /(lemon|sitruuna|citron)/, exclude: /(grass|ruoho)/,
  },
  {
    id: "frozen_berries", label: "frozen berries", categories: ["41740"],
    terms: ["berries", "frozen berries", "berry mix", "pakastemarjat", "marjat", "marjoja", "marjasekoitus", "bär", "frysta bär"],
    include: /(berr|marja|bär|mustikka|vadelma|mansikka|puolukka|cherr)/,
  },
  {
    id: "peas", label: "peas", categories: ["41731", "17408"],
    terms: ["peas", "green peas", "herne", "herneet", "herneitä", "ärter", "gröna ärter"],
    include: /(\bpeas?\b|herne|ärt)/, exclude: /(chick|kikher|snap|sokeri|pod|shoot|verso|soup|keitto)/,
  },
];
