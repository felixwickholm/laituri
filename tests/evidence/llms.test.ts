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
  return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts")) || existsSync(path.join(process.cwd(), "public", pathname));
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

  it("tells an agent the answer each order outcome gets", () => {
    expect(text).toMatch(/201 confirmed/);
    expect(text).toMatch(/202 pending_approval/);
    expect(text).toMatch(/422 order_blocked[^\n]*order\.decision\.checks/);
  });

  it("keeps what an outside agent needs to buy: its own sandbox key first, every tool and a curl line per step", () => {
    const flow = text.slice(text.indexOf("**REST flow"));
    expect(flow.split("\n").find((line) => line.includes("curl"))).toBe(`KEY=$(curl -s -X POST ${ORIGIN}/api/v1/workspace | jq -r '.agentKeys[0].key')`);
    expect(text).toContain("Authorization: Bearer $KEY");
    for (const tool of TOOLS) expect(text).toContain(tool.name);
    for (const step of ["/products/search", "/quotes", "/mandate", "/orders"]) {
      expect(lines.some((line) => line.startsWith(`curl -s ${ORIGIN}/api/v1${step}`)), step).toBe(true);
    }
  });

  it("sends the buyer's words with every quote, and names the fixed tokens as the shared demo workspace", () => {
    for (const line of lines.filter((each) => each.startsWith(`curl -s ${ORIGIN}/api/v1/quotes`))) expect(line).toMatch(/"intent":"[^"]+"/);
    expect(text).toMatch(/shared demo workspace[^\n]*demo-agent-token/);
  });
});
