import type { Course, Occasion } from "@/lib/contracts";

/** One group of Valio Aimo recipes the import takes, chosen by words in the page address. */
export interface Bucket {
  id: string;
  /** Matches the recipe's address (slug). */
  match: RegExp;
  /** Slugs that go first inside the bucket. */
  prefer?: RegExp;
  quota: number;
  /** The course when Valio's own category does not decide it. */
  course: Course;
  occasions: Occasion[];
}

export const MAX_RECIPES = 150;

/**
 * What a hotel, school or event kitchen plans: mains, sides, desserts, buffet and breakfast dishes, with celebration and
 * Christmas dishes for November. The mentor's bolognese and cream cake come first in their groups.
 */
export const BUCKETS: Bucket[] = [
  { id: "bolognese", match: /bolognese|jauhelihakastike|lasagne|lihakastike/, prefer: /bolognese|jauhelihakastike$|^lasagne$/, quota: 8, course: "main", occasions: ["lunch", "dinner", "buffet"] },
  { id: "cream-cake", match: /kermakakku|taytekakku|taytekakut/, prefer: /^kermakakku$|gluteeniton-kermakakku|hedelma-?kermakakku/, quota: 10, course: "dessert", occasions: ["celebration", "buffet", "dinner"] },
  { id: "christmas", match: /joulu|rosolli|lanttulaatikko|porkkanalaatikko|imellet|kinkku|graavi|sillisalaatti|riisipuuro/, quota: 16, course: "main", occasions: ["celebration", "buffet", "dinner"] },
  { id: "soup", match: /keitto/, quota: 12, course: "main", occasions: ["lunch", "dinner", "buffet"] },
  { id: "fish", match: /lohi|kala|silakka|kuha|turska|seiti|muikku/, quota: 14, course: "main", occasions: ["dinner", "lunch", "celebration"] },
  { id: "chicken", match: /broileri|(^|-)kana(?!pe)/, quota: 12, course: "main", occasions: ["lunch", "dinner", "buffet"] },
  { id: "meat", match: /jauheliha|liha|pyorykka|pihvi|possu|porsa|nauta|karjala|kaalikaaryle|makkara/, quota: 12, course: "main", occasions: ["lunch", "dinner", "buffet"] },
  { id: "vegetarian", match: /kasvis|vegaan|linssi|papu|harkis|nyhtokaura|tofu|halloumi|soija|kaurapata|pinaatti/, quota: 14, course: "main", occasions: ["lunch", "dinner", "buffet"] },
  { id: "side", match: /peruna|muusi|sose|salaatti|riisi|kasvikset|uunijuure|juurekse/, quota: 16, course: "side", occasions: ["lunch", "dinner", "buffet", "celebration"] },
  { id: "dessert", match: /mousse|kiisseli|rahka|pannacotta|panna-cotta|juustokakku|jalkiruoka|kinuski|pavlova|marenki|vaahto|creme/, quota: 18, course: "dessert", occasions: ["dinner", "lunch", "buffet", "celebration"] },
  { id: "breakfast", match: /puuro|munakas|aamiai|smoothie|jogurtti|pannukak|granola|tuorepuuro|munakokkeli|toast/, quota: 12, course: "main", occasions: ["breakfast", "buffet"] },
  { id: "buffet-starter", match: /voileipakakku|canape|tartaletti|blini|piirakka|alkuruoka|terriini|cocktailpala|pikkupala|tapas/, quota: 10, course: "starter", occasions: ["buffet", "celebration", "dinner"] },
];
