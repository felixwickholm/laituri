/**
 * Canonical JSON in the spirit of RFC 8785: object keys sorted, no whitespace,
 * and the same value rules as JSON.stringify (undefined fields dropped, non-finite numbers as null).
 * Browser-safe: no Node-only imports.
 */
export function canonicalize(value: unknown): string {
  const text = serialize(value);
  return text === undefined ? "null" : text;
}

function serialize(value: unknown): string | undefined {
  if (value !== null && typeof value === "object" && typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return serialize((value as { toJSON: () => unknown }).toJSON());
  }
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "bigint":
      throw new TypeError("BigInt values cannot be serialised to JSON.");
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serialize(item) ?? "null").join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const item = serialize(record[key]);
    if (item !== undefined) parts.push(`${JSON.stringify(key)}:${item}`);
  }
  return `{${parts.join(",")}}`;
}

/** SHA-256 over the canonical JSON of a value, as lowercase hex. */
export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
