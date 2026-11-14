import manifest from "./images.json";

/**
 * Product pictures for the screens.
 *
 * Photos come from the wholesaler's own product pages on valioaimo.fi (`npm exec tsx scripts/product-images.ts`
 * fetches them, matched by GTIN, and records the page each came from in `images.json`). A product without a photo
 * gets a drawn tile in its category's colour with a simple icon: no brand, no invented packaging.
 */

export interface ImageEntry {
  /** Path under /public, for example /products/464306.webp. */
  src: string;
  /** The product page the photo was taken from. */
  source: string;
}

export interface ProductImage {
  src: string;
  kind: "photo" | "placeholder";
}

const PHOTOS = manifest as Record<string, ImageEntry>;

export const PLACEHOLDER_KINDS = [
  "dairy",
  "eggs",
  "bread",
  "vegetable",
  "fruit",
  "drink",
  "dry_goods",
  "meat_fish",
  "plant_based",
  "generic",
] as const;
export type PlaceholderKind = (typeof PLACEHOLDER_KINDS)[number];

const KIND_BY_GROUP: Record<string, PlaceholderKind> = {
  dairy: "dairy",
  cheese: "dairy",
  ice_cream: "dairy",
  fats_oils: "dairy",
  eggs: "eggs",
  bakery: "bread",
  produce: "vegetable",
  beverages: "drink",
  coffee_tea: "drink",
  dry_goods: "dry_goods",
  baking_spices: "dry_goods",
  preserves: "dry_goods",
  sauces_condiments: "dry_goods",
  snacks_sweets: "dry_goods",
  meat: "meat_fish",
  fish: "meat_fish",
  ready_meals: "meat_fish",
  plant_based: "plant_based",
};

const FRUIT_CONCEPTS = new Set(["apple", "banana", "orange", "lemon", "lime", "berries", "strawberry", "pear", "grapes", "melon", "fruit"]);

/** Which drawn tile a product without a photo gets, from its category group (and concept, to tell fruit from vegetables). */
export function placeholderKind(categoryGroup?: string, concept?: string): PlaceholderKind {
  const kind = (categoryGroup && KIND_BY_GROUP[categoryGroup]) || "generic";
  if (kind === "vegetable" && concept && FRUIT_CONCEPTS.has(concept)) return "fruit";
  return kind;
}

/** The tile behind each icon, and the icon's ink. */
export const PLACEHOLDER_COLOURS: Record<PlaceholderKind, { tile: string; ink: string }> = {
  dairy: { tile: "#E6F0F8", ink: "#3D6A8F" },
  eggs: { tile: "#FBF1DC", ink: "#9A6B1F" },
  bread: { tile: "#F6E9DA", ink: "#8C5A2B" },
  vegetable: { tile: "#E5F2E1", ink: "#3F7A3A" },
  fruit: { tile: "#FBE7E1", ink: "#B0493A" },
  drink: { tile: "#E2F2F1", ink: "#2D7672" },
  dry_goods: { tile: "#F3EEDF", ink: "#7A6A3A" },
  meat_fish: { tile: "#F8E4E4", ink: "#9A3F45" },
  plant_based: { tile: "#EAF3DD", ink: "#557A26" },
  generic: { tile: "#ECEDEF", ink: "#5B6270" },
};

/** Icon strokes on a 96 x 96 grid, centred in the tile. */
const ICONS: Record<PlaceholderKind, string> = {
  // A gable-top carton.
  dairy:
    '<path d="M34 34 L48 20 L62 34 V76 H34 Z"/><path d="M34 34 H62"/><path d="M41 20 H55"/><path d="M40 48 H56"/>',
  // Three eggs.
  eggs:
    '<ellipse cx="34" cy="56" rx="11" ry="15"/><ellipse cx="62" cy="56" rx="11" ry="15"/><ellipse cx="48" cy="40" rx="11" ry="15"/>',
  // A loaf with scores.
  bread:
    '<path d="M22 64 C22 42 74 42 74 64 V72 H22 Z"/><path d="M36 50 L32 58"/><path d="M49 47 L45 56"/><path d="M62 50 L58 58"/>',
  // A carrot with leaves.
  vegetable:
    '<path d="M60 36 L30 72 C27 75 23 71 26 68 L62 38"/><path d="M60 36 C64 32 68 32 70 34 C72 36 72 40 68 44 L62 38"/><path d="M66 32 L72 20"/><path d="M70 36 L80 30"/><path d="M42 58 L47 62"/><path d="M50 49 L55 53"/>',
  // An apple with a leaf.
  fruit:
    '<path d="M48 36 C36 28 22 36 24 54 C26 70 38 78 48 72 C58 78 70 70 72 54 C74 36 60 28 48 36 Z"/><path d="M48 36 V24"/><path d="M50 28 C56 20 64 22 64 22 C62 30 54 32 50 28 Z"/>',
  // A bottle.
  drink:
    '<path d="M42 18 H54 V30 C62 34 64 40 64 48 V76 H32 V48 C32 40 34 34 42 30 Z"/><path d="M32 52 H64"/><path d="M32 66 H64"/>',
  // A sack tied at the top.
  dry_goods:
    '<path d="M38 28 H58 L54 36 C68 42 72 56 70 74 H26 C24 56 28 42 42 36 Z"/><path d="M40 36 H56"/><path d="M40 56 C44 52 52 52 56 56"/>',
  // A fish.
  meat_fish:
    '<path d="M20 48 C30 34 50 32 64 44 L76 34 V62 L64 52 C50 64 30 62 20 48 Z"/><circle cx="32" cy="46" r="2.5"/><path d="M46 40 C49 44 49 52 46 56"/>',
  // A leaf with veins.
  plant_based:
    '<path d="M26 72 C24 44 42 24 72 22 C74 52 56 72 26 72 Z"/><path d="M26 72 L60 36"/><path d="M42 54 L42 44"/><path d="M42 54 L52 54"/>',
  // A plain box.
  generic:
    '<path d="M24 38 L48 26 L72 38 V64 L48 76 L24 64 Z"/><path d="M24 38 L48 50 L72 38"/><path d="M48 50 V76"/>',
};

/** A self-contained SVG tile for one placeholder kind. Used to write public/products/placeholders/<kind>.svg. */
export function placeholderSvg(kind: PlaceholderKind): string {
  const { tile, ink } = PLACEHOLDER_COLOURS[kind];
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="480" height="480" role="img" aria-hidden="true">',
    `<rect width="96" height="96" rx="14" fill="${tile}"/>`,
    `<g transform="translate(13.44 13.44) scale(0.72)" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">`,
    ICONS[kind],
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

export function placeholderSrc(kind: PlaceholderKind): string {
  return `/products/placeholders/${kind}.svg`;
}

/** The photo path for a product, or undefined when none was found. */
export function productPhoto(productId: string): string | undefined {
  return Object.hasOwn(PHOTOS, productId) ? PHOTOS[productId].src : undefined;
}

/**
 * The picture to show for a product: its photo from the wholesaler's site, or a drawn tile for its category.
 * `category` is the readable category group (Product.categoryGroup, for example "dairy"); pass the concept to tell
 * fruit from vegetables.
 */
export function productImage(productId: string, category?: string, concept?: string): ProductImage {
  const photo = productPhoto(productId);
  if (photo) return { src: photo, kind: "photo" };
  return { src: placeholderSrc(placeholderKind(category, concept)), kind: "placeholder" };
}
