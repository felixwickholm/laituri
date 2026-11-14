import { describe, expect, it } from "vitest";
import { clientAddress } from "@/lib/http/client-address";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("the client address behind one trusted proxy", () => {
  it("ignores X-Forwarded-For entries the client wrote, keeping the one the proxy added", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddress(headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers X-Real-IP, which the proxy sets itself", () => {
    expect(clientAddress(headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.7");
  });

  it("says unknown without either header", () => {
    expect(clientAddress(headers({}))).toBe("unknown");
    expect(clientAddress(headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
