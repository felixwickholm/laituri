import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string): never => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect }));

const { default: Home } = await import("@/app/page");

function open(params: Record<string, string | string[] | undefined>) {
  return Home({ params: Promise.resolve({}), searchParams: Promise.resolve(params) } as Parameters<typeof Home>[0]);
}

describe("the front door", () => {
  it("opens the product, the kitchen's Today, not a landing page", async () => {
    await expect(open({})).rejects.toThrow("redirect:/buyer");
  });

  it("keeps the address's query, so /?tour=start still opens the walkthrough", async () => {
    await expect(open({ tour: "start" })).rejects.toThrow("redirect:/buyer?tour=start");
    await expect(open({ a: ["1", "2"] })).rejects.toThrow("redirect:/buyer?a=1&a=2");
  });

  it("keeps the story about Laituri at /about", async () => {
    const about = await import("@/app/about/page");
    expect(about.metadata).toMatchObject({ title: "About", alternates: { canonical: "/about" } });
  });
});
