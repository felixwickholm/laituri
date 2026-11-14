import "../http/env";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/openapi.json/route";
import { jsonRequest } from "../http/env";

type Json = Record<string, unknown>;

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, found));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

function resolvePointer(doc: Json, ref: string): unknown {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce<unknown>((node, part) => (node as Json | undefined)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], doc);
}

describe("OpenAPI document", async () => {
  const response = await GET(jsonRequest("/api/v1/openapi.json"));
  const doc = (await response.json()) as Json;

  it("is OpenAPI 3.1 with a server from the request origin", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers).toEqual([{ url: "http://localhost:3299" }]);
    expect((doc["x-assumptions"] as string[]).length).toBe(3);
  });

  it("gives every operation a unique operationId", () => {
    const ids: string[] = [];
    for (const item of Object.values(doc.paths as Json)) {
      for (const operation of Object.values(item as Json)) {
        const id = (operation as Json).operationId;
        expect(typeof id).toBe("string");
        ids.push(id as string);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["searchCatalog", "requestQuote", "placeOrder", "decideApproval"]));
  });

  it("resolves every $ref", () => {
    const refs = collectRefs(doc);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of new Set(refs)) {
      expect(resolvePointer(doc, ref), ref).toBeDefined();
    }
  });

  it("describes errors as problem details", () => {
    const quote = (doc.paths as Json)["/api/v1/quotes"] as Json;
    const responses = (quote.post as Json).responses as Json;
    expect(Object.keys(responses["400"] as Json)).toContain("content");
    expect(JSON.stringify(responses["400"])).toContain("application/problem+json");
  });

  it("documents the wholesaler's suspension control, the voice routes and every health field", () => {
    const paths = doc.paths as Record<string, Record<string, Json>>;
    const suspend = paths["/api/v1/supplier/agents/{agentId}/suspension"].post;
    expect(suspend.operationId).toBe("setAgentSuspension");
    expect(suspend.description).toMatch(/agent_suspended[\s\S]*refuses agent credentials[\s\S]*own sign-in/);
    expect(Object.keys(paths["/api/v1/voice"].get.responses as Json)).toEqual(["200", "403"]);
    expect(Object.keys((paths["/api/v1/voice/speech"].post.responses as Record<string, Json>)["200"].content as Json)).toEqual(["audio/mpeg"]);

    const schemas = (doc.components as { schemas: Record<string, { properties: Record<string, Json> }> }).schemas;
    expect(Object.keys(schemas.Health.properties)).toEqual(expect.arrayContaining(["seed", "agent"]));
    expect(schemas.SuspensionState.properties.suspended).toBeDefined();
    expect(JSON.stringify(schemas.SearchResponse)).toContain("categoryAverageCo2PerKg");
    expect(JSON.stringify(schemas.QuoteResponse)).toContain("meaning");
    expect(JSON.stringify(schemas.SearchRequest)).toContain("sustainability");
  });
});
