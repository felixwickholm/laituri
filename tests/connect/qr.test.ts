import { describe, expect, it } from "vitest";
import { MAX_QR_BYTES, encodeQr, penalty, qrPath, versionFor, type QrMatrix } from "@/lib/connect/qr";
import { QR_VECTORS } from "./qr-vectors";

/** The matrix as hex rows, the way the vectors store it. */
function hexRows(matrix: QrMatrix): string[] {
  return matrix.map((row) => {
    const bits = row.map((dark) => (dark ? "1" : "0")).join("");
    return BigInt(`0b${bits}`).toString(16).padStart(Math.ceil(bits.length / 4), "0");
  });
}

describe("QR encoder", () => {
  it.each(QR_VECTORS)("matches segno module for module: version $version, mask $mask", ({ text, mask, version, rows }) => {
    const matrix = encodeQr(text, mask);
    expect(matrix.length).toBe(version * 4 + 17);
    expect(hexRows(matrix)).toEqual(rows);
  });

  it.each(QR_VECTORS)("picks the mask with the lowest penalty: version $version", ({ text }) => {
    const scores = Array.from({ length: 8 }, (_, mask) => penalty(encodeQr(text, mask)));
    expect(penalty(encodeQr(text))).toBe(Math.min(...scores));
  });

  it("chooses the smallest version that holds the bytes", () => {
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(122)).toBe(7);
    expect(versionFor(123)).toBe(8);
    expect(versionFor(MAX_QR_BYTES)).toBe(10);
    expect(() => versionFor(MAX_QR_BYTES + 1)).toThrow(RangeError);
  });

  it("draws one closed rectangle per run of dark modules", () => {
    expect(qrPath([[true, true, false, true]], 4)).toBe("M4 4h2v1h-2zM7 4h1v1h-1z");
  });
});
