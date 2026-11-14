import "../store/temp-data-dir";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";

const { evidence, LIVE_URL } = await import("@/lib/evidence");
const { llmsFullText } = await import("@/lib/discovery/llms-full");
const { llmsText } = await import("@/lib/discovery/llms");
const { readPaper } = await import("@/lib/discovery/paper");
const { PUBLIC_PATHS } = await import("@/lib/discovery/pages");
const { TOOLS } = await import("@/lib/mcp/tools");
const robots = (await import("@/app/robots")).default;
const sitemap = (await import("@/app/sitemap")).default;

const ORIGIN = "https://laituri.example";

function served(pathname: string): boolean {
  const dir = path.join(process.cwd(), "src", "app", ...pathname.split("/").filter(Boolean));
  return ["page.tsx", "route.ts"].some((file) => existsSync(path.join(dir, file))) || existsSync(path.join(process.cwd(), "public", pathname));
}

describe("llms-full.txt", () => {
  const text = llmsFullText(ORIGIN, readPaper());

  it("gives the whole picture in one fetch: what it is, the five criteria, the entry points and how to try it", () => {
    expect(text.split("\n")[0]).toMatch(/^# Laituri/);
    expect(text).toContain(evidence().pitch);
    for (const c of evidence().criteria) expect(text).toContain(c.name);
    for (const tool of TOOLS) expect(text).toContain(tool.name);
    for (const url of ["/api/v1/openapi.json", "/mcp", "/.well-known/jwks.json", "/api/v1/workspace", "/paper"]) expect(text).toContain(`${ORIGIN}${url}`);
    expect(text).toContain("How to evaluate this entry in five minutes");
  });

  it("keeps one H1 and the agent's REST flow", () => {
    expect(text.split("\n").filter((line) => line.startsWith("# "))).toHaveLength(1);
    expect(text).toContain("**REST flow");
  });
});

describe("llms.txt", () => {
  it("points to the paper and the full file before anything else", () => {
    const text = llmsText(ORIGIN);
    const first = text.indexOf(`${ORIGIN}/paper`);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(text.indexOf("Base URL"));
    expect(text).toContain(`${ORIGIN}/llms-full.txt`);
  });
});

describe("robots and sitemap", () => {
  it("lets every crawler read the public pages and names the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules).toContainEqual(expect.objectContaining({ userAgent: "*", allow: "/" }));
    expect(r.sitemap).toBe(`${LIVE_URL}/sitemap.xml`);
  });

  it("lists only pages and documents the app serves", () => {
    expect(PUBLIC_PATHS.filter((p) => !served(p))).toEqual([]);
    expect(sitemap().map((entry) => entry.url)).toEqual(PUBLIC_PATHS.map((p) => `${LIVE_URL}${p}`));
  });
});
