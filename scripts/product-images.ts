/**
 * Fetches product photos from the wholesaler's public site (valioaimo.fi) for the products the demo shows,
 * and draws a category tile for every product without one.
 *
 * How it finds a photo: the product sitemaps list every product page by name. The script ranks pages by how well
 * their address matches the product's name, opens the best few (one request a second) and accepts a page only when
 * its EAN code is one of the product's GTINs. The page's og:image is the photo. It is scaled to at most 480 px
 * (same picture, no cropping) and saved as public/products/<id>.webp; src/lib/catalog/images.json records it with
 * the page it came from.
 *
 * Everything fetched is cached under .data/product-images, so a re-run only asks for what is new.
 * Usage: npx tsx scripts/product-images.ts [--ids 464306,460001] [--refresh-misses] [--refresh-sitemaps]
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Product } from "../src/lib/contracts";
import { PLACEHOLDER_KINDS, placeholderSvg, type ImageEntry } from "../src/lib/catalog/images";

const SITE = "https://www.valioaimo.fi";
const VALIO_FI_SITEMAP = "https://www.valio.fi/vl_product-sitemap.xml";
const USER_AGENT = "Laituri-demo/0.1 (Junction 2026 product pictures; one request a second)";
const PAUSE_MS = 1_000;
const TIMEOUT_MS = 30_000;
const MAX_SIZE = 480;
const MAX_PAGES_PER_PRODUCT = 4;
const MIN_SCORE = 0.3;

const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".data", "product-images");
const SITEMAPS = path.join(CACHE, "sitemaps");
const PAGES = path.join(CACHE, "pages");
const ORIGINALS = path.join(CACHE, "originals");
const MATCHES = path.join(CACHE, "matches.json");
const OUT_DIR = path.join(ROOT, "public", "products");
const MANIFEST = path.join(ROOT, "src", "lib", "catalog", "images.json");

const args = process.argv.slice(2);
const refreshMisses = args.includes("--refresh-misses");
const refreshSitemaps = args.includes("--refresh-sitemaps");
const idsArg = args.includes("--ids") ? args[args.indexOf("--ids") + 1] : undefined;

interface Match {
  page?: string;
  image?: string;
  tried: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequest = 0;

/** Every request to the site goes through here: sequential, at most one a second. */
async function politeFetch(url: string, accept: string): Promise<Response | undefined> {
  const wait = lastRequest + PAUSE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`  ${response.status} ${url}`);
      return undefined;
    }
    return response;
  } catch (error) {
    console.warn(`  failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function cachedText(url: string, file: string, refresh = false): Promise<string | undefined> {
  if (!refresh && existsSync(file)) return readFile(file, "utf8");
  const response = await politeFetch(url, "text/html,application/xml;q=0.9,*/*;q=0.5");
  if (!response) return undefined;
  const text = await response.text();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return text;
}

/** robots.txt allows product pages and sitemaps; only the search pages with query strings are disallowed. */
async function checkRobots(): Promise<void> {
  const robots = await cachedText(`${SITE}/robots.txt`, path.join(CACHE, "robots.txt"), refreshSitemaps);
  if (!robots) throw new Error("Could not read robots.txt; stopping.");
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
  if (disallowed.some((rule) => rule === "/" || rule.startsWith("/toimitustukku") || rule.startsWith("/ammattilaistuotteet"))) {
    throw new Error("robots.txt disallows product pages; stopping.");
  }
  const valio = await cachedText("https://www.valio.fi/robots.txt", path.join(CACHE, "valio-fi-robots.txt"), refreshSitemaps);
  if (!valio || /^Disallow:\s*\/(?:tuotteet|vl_product)?\s*$/im.test(valio)) throw new Error("valio.fi robots.txt disallows product pages; stopping.");
}

interface Sitemaps {
  /** Wholesale and professional product pages on valioaimo.fi, for name matching. */
  pages: string[];
  /** Valio's own product pictures by Valio product number (the number ends the picture's file name). */
  valioImages: Map<string, { page: string; image: string }>;
}

async function readSitemaps(): Promise<Sitemaps> {
  const index = await cachedText(`${SITE}/sitemap_index.xml`, path.join(SITEMAPS, "sitemap_index.xml"), refreshSitemaps);
  if (!index) throw new Error("Could not read the sitemap index.");
  const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((url) => /\/vl_product(-aimo)?-sitemap\d*\.xml$/.test(url));
  const pages: string[] = [];
  const valioImages: Sitemaps["valioImages"] = new Map();
  const collect = (xml: string) => {
    for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const page = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (!page) continue;
      if (/^https:\/\/www\.valioaimo\.fi\/(?:toimitustukku|ammattilaistuotteet)\//.test(page)) pages.push(page);
      for (const [, image] of block.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) {
        const number = image.match(/-(\d+)\.(?:png|jpe?g|webp)$/i)?.[1];
        if (number && !valioImages.has(String(Number(number)))) valioImages.set(String(Number(number)), { page, image });
      }
    }
  };
  for (const sitemap of sitemaps) {
    const xml = await cachedText(sitemap, path.join(SITEMAPS, path.basename(sitemap)), refreshSitemaps);
    if (xml) collect(xml);
  }
  // Valio's consumer site carries the pictures of Valio's retail packs (milk, cream, yoghurt) that the
  // professional pages on valioaimo.fi do not. Same company, same picture library; read after valioaimo.fi.
  const consumer = await cachedText(VALIO_FI_SITEMAP, path.join(SITEMAPS, "valio-fi-vl_product-sitemap.xml"), refreshSitemaps);
  if (consumer) collect(consumer);
  return { pages: [...new Set(pages)], valioImages };
}

/** Valio product numbers inside Valio GTINs: 640843 0 NNNNN C -> NNNNN. */
function valioNumbers(product: Product): string[] {
  const all = [product.gtin, ...product.units.map((u) => u.gtin)].filter((g): g is string => Boolean(g));
  return [...new Set(all.filter((g) => /^6408430\d{6}$/.test(g)).map((g) => String(Number(g.slice(7, 12)))))];
}

/** The site's address form of a name: "Torino 10kg makaroni" -> "torino-10-kg-makaroni". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/(\d)([a-zäöå])/g, "$1 $2")
    .replace(/([a-zäöå])(\d)/g, "$1 $2")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pageSlug(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? "";
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared || 1);
}

interface Indexed {
  url: string;
  slug: string;
  tokens: Set<string>;
}

function candidates(product: Product, pages: Indexed[]): string[] {
  const names = [product.name.fi, product.name.en, product.name.sv].filter((n): n is string => Boolean(n));
  const slugs = new Set(names.map(slugify));
  const exact = pages.filter((p) => slugs.has(p.slug) || slugs.has(p.slug.replace(/-\d+$/, ""))).map((p) => p.url);
  const tokens = names.map((n) => new Set(slugify(n).split("-")));
  const ranked = pages
    .map((p) => ({ url: p.url, score: Math.max(...tokens.map((t) => jaccard(t, p.tokens))) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.url);
  return [...new Set([...exact, ...ranked])].slice(0, MAX_PAGES_PER_PRODUCT);
}

function gtins(product: Product): Set<string> {
  const all = [product.gtin, ...product.units.map((u) => u.gtin)].filter((g): g is string => Boolean(g));
  return new Set(all.map((g) => g.replace(/^0+/, "")));
}

/** The EAN codes a product page states for its own product (not the related products further down). */
function pageEans(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return [...text.matchAll(/(?:EAN-koodi|Ean-numero|EAN-numero|EAN)\s*:?\s*(\d{8,14})/g)].map((m) => m[1].replace(/^0+/, ""));
}

function ogImage(html: string): string | undefined {
  const tag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  const url = tag?.match(/content=["']([^"']+)["']/i)?.[1];
  if (!url || /logo|favicon|placeholder|default/i.test(url)) return undefined;
  return url.replace(/&amp;/g, "&");
}

function pageFile(url: string): string {
  const [, section] = url.match(/valioaimo\.fi\/([^/]+)\//) ?? [];
  return path.join(PAGES, section ?? "other", `${pageSlug(url)}.html`);
}

async function findMatch(product: Product, pages: Indexed[], valioImages: Sitemaps["valioImages"]): Promise<Match> {
  // A Valio picture's file name ends in the Valio product number, which is also inside the product's GTIN.
  for (const number of valioNumbers(product)) {
    const hit = valioImages.get(number);
    if (hit) return { page: hit.page, image: hit.image, tried: [] };
  }
  const wanted = gtins(product);
  const tried: string[] = [];
  for (const url of candidates(product, pages)) {
    tried.push(url);
    const html = await cachedText(url, pageFile(url));
    if (!html) continue;
    if (!pageEans(html).some((ean) => wanted.has(ean))) continue;
    const image = ogImage(html);
    if (image) return { page: url, image, tried };
  }
  return { tried };
}

async function downloadImage(id: string, imageUrl: string): Promise<string | undefined> {
  const cached = (await readdir(ORIGINALS).catch(() => [] as string[])).find((f) => f.startsWith(`${id}.`));
  if (cached) return path.join(ORIGINALS, cached);
  const response = await politeFetch(imageUrl, "image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5");
  if (!response) return undefined;
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return undefined;
  const ext = type.split("/")[1].split(";")[0].replace("jpeg", "jpg") || "img";
  await mkdir(ORIGINALS, { recursive: true });
  const file = path.join(ORIGINALS, `${id}.${ext}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/** The same picture, only smaller: fit inside 480 x 480 without cropping or enlarging. */
async function toWebp(original: string, target: string): Promise<void> {
  await sharp(original)
    .rotate()
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(target);
}

function readLines(file: string): Promise<Product[]> {
  return readFile(file, "utf8").then((text) => JSON.parse(text) as Product[]);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.join(OUT_DIR, "placeholders"), { recursive: true });
  for (const kind of PLACEHOLDER_KINDS) {
    await writeFile(path.join(OUT_DIR, "placeholders", `${kind}.svg`), placeholderSvg(kind));
  }

  // The products the demo shows are exactly the recorded ones; recipes, weekly orders and suggestions use only those.
  const recorded = await readLines(path.join(ROOT, "fixtures", "upstream", "catalog.json"));
  const full = existsSync(path.join(ROOT, ".data", "catalog.json")) ? await readLines(path.join(ROOT, ".data", "catalog.json")) : [];
  const byId = new Map([...full, ...recorded].map((p) => [p.id, p]));
  const ids = idsArg ? idsArg.split(",").map((s) => s.trim()).filter(Boolean) : recorded.map((p) => p.id);
  const targets = ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));

  await checkRobots();
  const sitemaps = await readSitemaps();
  const pages: Indexed[] = sitemaps.pages.map((url) => {
    const slug = pageSlug(url);
    return { url, slug, tokens: new Set(slug.split("-")) };
  });
  console.log(`${pages.length} product pages in the sitemaps; looking for ${targets.length} products.`);

  const matches: Record<string, Match> = existsSync(MATCHES) ? JSON.parse(await readFile(MATCHES, "utf8")) : {};
  const manifest: Record<string, ImageEntry> = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};

  let n = 0;
  for (const product of targets) {
    n++;
    const known = matches[product.id];
    if (!known || (!known.page && refreshMisses)) {
      matches[product.id] = await findMatch(product, pages, sitemaps.valioImages);
      await writeFile(MATCHES, JSON.stringify(matches, null, 1));
    }
    const match = matches[product.id];
    const target = path.join(OUT_DIR, `${product.id}.webp`);
    if (match.page && match.image) {
      if (!existsSync(target)) {
        const original = await downloadImage(product.id, match.image);
        if (original) await toWebp(original, target);
      }
      if (existsSync(target)) manifest[product.id] = { src: `/products/${product.id}.webp`, source: match.page };
    }
    console.log(`${n}/${targets.length} ${product.id} ${manifest[product.id] ? "photo" : "placeholder"}  ${product.name.fi}`);
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);

  let bytes = 0;
  for (const file of await readdir(OUT_DIR, { recursive: true })) {
    const info = await stat(path.join(OUT_DIR, file));
    if (info.isFile()) bytes += info.size;
  }
  const photos = targets.filter((p) => manifest[p.id]).length;
  console.log(
    `Photos: ${photos} of ${targets.length}; placeholders: ${targets.length - photos}. public/products: ${(bytes / 1_048_576).toFixed(1)} MB.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
