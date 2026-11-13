import "../store/temp-data-dir";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalize, jwks, ROLES, sha256Hex, trust, verifyWithJwks } from "@/lib/trust";
import { testDataDir } from "../store/temp-data-dir";

function tamper(jws: string): string {
  const [header, , signature] = jws.split(".");
  const payload = Buffer.from(JSON.stringify({ total: 9999 })).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("trust", () => {
  it.each(ROLES)("signs and verifies for %s", async (role) => {
    const jws = await trust().sign(role, { hello: role, n: 1 });
    const result = await trust().verify<{ hello: string }>(role, jws);
    expect(result.valid).toBe(true);
    expect(result.payload?.hello).toBe(role);
  });

  it("writes keys under the data dir override", async () => {
    await trust().sign("supplier", {});
    const file = path.join(testDataDir!, "keys", "supplier.json");
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf8")).d).toBeTypeOf("string");
  });

  it("rejects an altered payload", async () => {
    const jws = await trust().sign("supplier", { total: 10 });
    const result = await trust().verify("supplier", tamper(jws));
    expect(result).toMatchObject({ valid: false, reason: "signature does not match" });
  });

  it("rejects a token signed by another role", async () => {
    const jws = await trust().sign("buyer", { total: 10 });
    expect(await trust().verify("supplier", jws)).toMatchObject({ valid: false, reason: "unknown key" });
  });

  it("rejects malformed input without throwing", async () => {
    expect(await trust().verify("supplier", "not-a-token")).toMatchObject({ valid: false, reason: "malformed token" });
    expect(await trust().verify("supplier", "a.b.c")).toMatchObject({ valid: false, reason: "malformed token" });
  });

  it("publishes a JWKS with the kid and no private part", async () => {
    const set = await jwks("approver");
    const jws = await trust().sign("approver", { ok: true });
    const kid = JSON.parse(Buffer.from(jws.split(".")[0], "base64url").toString()).kid;
    expect(set.keys).toHaveLength(1);
    expect(set.keys[0].kid).toBe(kid);
    expect(set.keys[0]).not.toHaveProperty("d");
  });

  it("verifies with the public JWKS only", async () => {
    const jws = await trust().sign("supplier", { ok: true });
    expect((await verifyWithJwks(jws, await jwks("supplier"))).valid).toBe(true);
    expect(await verifyWithJwks(jws, await jwks("buyer"))).toMatchObject({ valid: false, reason: "unknown key" });
    expect((await verifyWithJwks(tamper(jws), await jwks("supplier"))).reason).toBe("signature does not match");
  });

  it("returns the same key to concurrent first callers", async () => {
    const [a, b] = await Promise.all([jwks("buyer"), jwks("buyer")]);
    expect(a.keys[0].kid).toBe(b.keys[0].kid);
  });

  it("canonicalises with sorted keys and no whitespace", async () => {
    expect(canonicalize({ b: 1, a: [true, null, { d: "x", c: undefined }] })).toBe('{"a":[true,null,{"d":"x"}],"b":1}');
    expect(await sha256Hex({ a: 1, b: 2 })).toBe(await sha256Hex({ b: 2, a: 1 }));
    expect(await sha256Hex("")).toMatch(/^[0-9a-f]{64}$/);
  });
});
