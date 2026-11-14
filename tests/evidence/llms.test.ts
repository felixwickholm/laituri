import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { llmsText } from "@/lib/discovery/llms";
import { TOOLS } from "@/lib/mcp/tools";

const ORIGIN = "https://laituri.example";
const text = llmsText(ORIGIN);
const lines = text.split("\n");

/** The App Router file that serves a URL path, if any. */
function served(url: string): boolean {
  const pathname = new URL(url).pathname;
  const dir = path.join(process.cwd(), "src", "app", ...pathname.split("/").filter(Boolean));
  return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts"));
}

describe("llms.txt", () => {
  it("follows the llmstxt.org shape: H1, blockquote, detail, then H2 link lists", () => {
    expect(lines[0]).toMatch(/^# \S/);
    expect(lines.filter((line) => line.startsWith("# "))).toHaveLength(1);
    const firstContent = lines.slice(1).find((line) => line.trim() !== "");
    expect(firstContent?.startsWith("> ")).toBe(true);
    const h2 = lines.filter((line) => line.startsWith("## ")).map((line) => line.slice(3));
    expect(h2).toEqual(["Docs", "API", "Evidence", "Optional"]);
    const firstH2 = lines.findIndex((line) => line.startsWith("## "));
    expect(lines.slice(1, firstH2).some((line) => /^#{1,6} /.test(line))).toBe(false);
  });

  it("lists only links, each to a route the app serves", () => {
    const firstH2 = lines.findIndex((line) => line.startsWith("## "));
    const items = lines.slice(firstH2).filter((line) => line.trim() !== "" && !line.startsWith("## "));
    for (const item of items) {
      const match = item.match(/^- \[[^\]]+\]\(([^)]+)\)(: .+)?$/);
      expect(match, item).not.toBeNull();
      expect(served(match![1]), item).toBe(true);
    }
  });

  it("keeps what an outside agent needs to buy: the token, every tool and a curl line per step", () => {
    expect(text).toContain("Authorization: Bearer demo-agent-token");
    for (const tool of TOOLS) expect(text).toContain(tool.name);
    for (const step of ["/products/search", "/quotes", "/mandate", "/orders"]) {
      expect(lines.some((line) => line.startsWith(`curl -s ${ORIGIN}/api/v1${step}`)), step).toBe(true);
    }
  });
});
