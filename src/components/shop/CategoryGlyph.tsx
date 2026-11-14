import { Apple, Croissant, CupSoda, Egg, Leaf, Milk, Package, Wheat, type LucideIcon } from "lucide-react";

const GLYPHS: Record<string, LucideIcon> = {
  dairy: Milk,
  cheese: Milk,
  bakery: Croissant,
  produce: Apple,
  dry_goods: Wheat,
  beverages: CupSoda,
  eggs: Egg,
  plant_based: Leaf,
};

/** A small mark for the product's category group, in place of a product photo. */
export function CategoryGlyph({ group }: { group: string }) {
  const Glyph = GLYPHS[group] ?? Package;
  return (
    <span className="store-glyph" aria-hidden="true">
      <Glyph />
    </span>
  );
}
