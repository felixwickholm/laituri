import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "@/lib/catalog";
import {
  PLACEHOLDER_KINDS,
  placeholderKind,
  placeholderSrc,
  placeholderSvg,
  productImage,
  type ImageEntry,
} from "@/lib/catalog/images";
import manifest from "@/lib/catalog/images.json";
import { SearchHit } from "@/lib/contracts";

const PUBLIC = path.join(process.cwd(), "public");
const photos = manifest as Record<string, ImageEntry>;

describe("product pictures", () => {
  it("every manifest entry points at a file in public/ and names the page it came from", () => {
    for (const [id, entry] of Object.entries(photos)) {
      expect(entry.src).toBe(`/products/${id}.webp`);
      expect(existsSync(path.join(PUBLIC, entry.src))).toBe(true);
      expect(entry.source).toMatch(/^https:\/\/www\.valio(aimo)?\.fi\//);
    }
  });

  it("keeps the pictures small", () => {
    let bytes = 0;
    for (const entry of Object.values(photos)) bytes += statSync(path.join(PUBLIC, entry.src)).size;
    expect(bytes).toBeLessThan(25 * 1_048_576);
  });

  it("has a drawn tile for every placeholder kind", () => {
    for (const kind of PLACEHOLDER_KINDS) {
      const file = path.join(PUBLIC, placeholderSrc(kind));
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, "utf8")).toBe(placeholderSvg(kind));
    }
  });

  it("returns the photo when there is one and the category tile otherwise", () => {
    const [id] = Object.keys(photos);
    if (id) expect(productImage(id, "dairy")).toEqual({ src: photos[id].src, kind: "photo" });
    expect(productImage("no-such-product", "eggs")).toEqual({ src: "/products/placeholders/eggs.svg", kind: "placeholder" });
    expect(productImage("no-such-product")).toEqual({ src: "/products/placeholders/generic.svg", kind: "placeholder" });
  });

  it("picks a tile from the category group, and tells fruit from vegetables", () => {
    expect(placeholderKind("cheese")).toBe("dairy");
    expect(placeholderKind("bakery")).toBe("bread");
    expect(placeholderKind("fish")).toBe("meat_fish");
    expect(placeholderKind("produce", "carrot")).toBe("vegetable");
    expect(placeholderKind("produce", "apple")).toBe("fruit");
    expect(placeholderKind("non_food")).toBe("generic");
  });

  it("draws no branding: the tile is shapes only", () => {
    for (const kind of PLACEHOLDER_KINDS) expect(placeholderSvg(kind)).not.toMatch(/<text|<image|href=/);
  });

  it("puts a picture on every search hit, and the contract accepts it", () => {
    const result = fixtureCatalog().search({ query: "maito", limit: 10 });
    expect(result.hits.length).toBeGreaterThan(0);
    for (const hit of result.hits) {
      expect(hit.image).toBe(productImage(hit.product.id, hit.product.categoryGroup, hit.product.concept).src);
      expect(SearchHit.parse(hit).image).toBe(hit.image);
    }
  });
});
