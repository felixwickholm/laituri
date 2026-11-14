import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.LAITURI_DATA_DIR = mkdtempSync(path.join(tmpdir(), "laituri-cookie-"));
const { isWorkspaceSecret, newWorkspaceSecret } = await import("@/lib/workspace/cookie");

const random43 = () => "A".repeat(20) + Math.random().toString(36).slice(2, 12).padEnd(23, "x");

describe("the workspace cookie", () => {
  it("accepts a value this server issued", () => {
    const issued = newWorkspaceSecret();
    expect(issued).toMatch(/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);
    expect(isWorkspaceSecret(issued)).toBe(true);
  });

  it("refuses a well-formed value the server never issued, so a made-up cookie cannot name a sandbox", () => {
    expect(isWorkspaceSecret(random43())).toBe(false);
    expect(isWorkspaceSecret(`${random43()}.${random43()}`)).toBe(false);
  });

  it("refuses an issued secret with its signature changed or moved to another secret", () => {
    const [secret, mac] = newWorkspaceSecret().split(".");
    const flipped = mac.slice(0, -1) + (mac.endsWith("A") ? "B" : "A");
    expect(isWorkspaceSecret(`${secret}.${flipped}`)).toBe(false);
    const [other] = newWorkspaceSecret().split(".");
    expect(isWorkspaceSecret(`${other}.${mac}`)).toBe(false);
    expect(isWorkspaceSecret(undefined)).toBe(false);
  });
});
