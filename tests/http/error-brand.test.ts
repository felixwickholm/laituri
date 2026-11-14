import { describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/lib/http/respond";

/**
 * Next bundles each route into its own module graph, so an error thrown by one copy of the errors module
 * reaches a respond module that imported another copy. instanceof fails there; the answer must not.
 */
async function secondCopy() {
  vi.resetModules();
  return import("@/lib/gateway/errors");
}

describe("errors thrown by a second copy of the errors module", () => {
  it("keep their status and code", async () => {
    const copy = await secondCopy();
    const cases = [
      [new copy.AgentSuspendedError("Suspended."), 403, "agent_suspended"],
      [new copy.NotFoundError("Order ord_x was not found."), 404, "not_found"],
      [new copy.ValidationError("Bad."), 400, "invalid_request"],
      [new copy.StateError("Twice."), 409, "invalid_state"],
      [new copy.UpstreamError("Down."), 502, "upstream_unavailable"],
    ] as const;
    for (const [error, status, code] of cases) {
      const response = errorResponse(error);
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ status, code, detail: error.message, type: `urn:laituri:problem:${code}` });
    }
  });

  it("gives a storage failure its own problem title", async () => {
    const copy = await secondCopy();
    const response = errorResponse(new copy.StorageError("The disk is full."));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ title: "Storage unavailable", code: "storage_unavailable" });
  });

  it("does not trust a plain object that only looks like an error", async () => {
    const response = errorResponse({ status: 403, code: "agent_suspended", message: "forged" });
    expect(response.status).toBe(500);
  });

  it("maps a schema error from a second copy of zod's error class to 400", async () => {
    vi.resetModules();
    const { z } = await import("zod");
    const parsed = z.object({ a: z.string() }).safeParse({});
    const response = errorResponse(parsed.error);
    expect(response.status).toBe(400);
    expect((await response.json()).violations[0]).toMatchObject({ path: "a" });
  });
});
