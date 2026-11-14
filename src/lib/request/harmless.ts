/**
 * Words outside the product phrase that ask nothing of the offer: what the goods are for ("for breakfast"),
 * and how a buyer asks an agent to choose ("find an option that meets our requirements based on price and
 * availability"). Any other word there is not understood, so the order waits for a person.
 */
const HARMLESS = new Set([
  // How a request is put.
  "i", "we", "me", "us", "you", "it", "this", "that", "these", "which", "a", "an", "the", "and", "or", "to", "of", "on",
  "in", "at", "for", "with", "from", "as", "is", "are", "be", "please", "thanks", "thank", "need", "needs", "want",
  "would", "like", "can", "could", "find", "choose", "pick", "select", "get", "option", "options", "offer",
  "offers", "one", "meets", "meet", "matches", "match", "fits", "fit", "our", "my", "your", "requirements",
  "requirement", "rules", "mandate", "based", "price", "prices", "pricing", "availability", "available", "stock",
  "best", "cheapest", "lowest", "good", "suitable", "usual", "normal", "regular", "delivery", "delivered", "deliver",
  // What the goods are for.
  "breakfast", "breakfasts", "brunch", "lunch", "lunches", "dinner", "dinners", "supper", "buffet", "buffets",
  "kitchen", "kitchens", "restaurant", "restaurants", "hotel", "hotels", "school", "schools", "canteen", "cafe",
  "café", "menu", "menus", "guests", "guest", "customers", "event", "events", "party", "week", "weekend", "service",
  "staff", "baking", "cooking", "coffee", "porridge", "soup", "pasta", "bake", "dessert", "desserts", "salad", "sauce",
  "burgers", "cakes", "pastries", "day", "days", "district", "next", "daily", "everyday",
  // Finnish and Swedish forms of the same.
  "tarvitsemme", "tarvitsen", "tarvitaan", "aamiainen", "aamiaiselle", "aamiaiseksi", "lounas", "lounaalle",
  "lounaaksi", "päivällinen", "päivälliselle", "keittiö", "keittiölle", "keittiöön", "ravintola", "ravintolalle",
  "hotelli", "hotellille", "koulu", "koululle", "viikko", "viikoksi", "hinta", "hinnan", "saatavuus", "saatavuuden",
  "perusteella", "frukost", "middag", "kök", "köket", "veckan", "pris", "tillgänglighet",
]);

export function isHarmless(word: string): boolean {
  return HARMLESS.has(word) || /^\d+$/.test(word);
}
