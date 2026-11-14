import "../http/env";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A corrupt snapshot is in place before the store loads for the first time.
writeFileSync(path.join(process.env.LAITURI_DATA_DIR!, "state.json"), "{not json");
const { GET } = await import("@/app/api/v1/health/route");
const { Health } = await import("@/lib/openapi/schemas");

describe("health after a corrupt snapshot", () => {
  it("is degraded and says where the unreadable snapshot was kept", async () => {
    const body = Health.parse(await (await GET(new Request("http://localhost:3299/api/v1/health"))).json());
    expect(body.status).toBe("degraded");
    expect(body.store.recovery?.keptAs).toContain("state.json.unreadable-");
    expect(body.store.recovery?.reason).toMatch(/JSON/);
  });
});
