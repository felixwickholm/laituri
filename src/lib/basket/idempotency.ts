import { createHash } from "node:crypto";
import { ConflictError, ValidationError } from "@/lib/gateway/errors";
import { workspaceState } from "@/lib/workspace/context";

interface Remembered {
  digest: string;
  basketId: Promise<string>;
}

/** Keys kept per workspace; the oldest is forgotten first. A retry comes within minutes, not after hundreds of baskets. */
export const MAX_REMEMBERED_KEYS = 500;
const KEY_PATTERN = /^[\x21-\x7e]{8,200}$/;

const remembered = workspaceState("basket.idempotency", () => new Map<string, Remembered>());

/** The Idempotency-Key header, when sent: 8 to 200 visible ASCII characters. */
export function basketIdempotencyKey(headers: Headers): string | undefined {
  const key = headers.get("idempotency-key")?.trim();
  if (!key) return undefined;
  if (!KEY_PATTERN.test(key)) throw new ValidationError("The Idempotency-Key header must be 8 to 200 visible ASCII characters.");
  return key;
}

/**
 * Starts a basket once per buyer and key. A repeat with the same request gets the first basket's id, even while the
 * first call is still running; the same key with a different request is a 409 conflict. Without a key every call starts
 * a new basket.
 */
export async function startOnce(buyerId: string, key: string | undefined, request: unknown, start: () => Promise<string>): Promise<string> {
  if (!key) return start();
  const all = remembered();
  const slot = `${buyerId}\n${key}`;
  const digest = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const found = all.get(slot);
  if (found) {
    if (found.digest !== digest) throw new ConflictError("This Idempotency-Key was already used for a different basket. Use a new key.");
    return found.basketId;
  }
  const basketId = start();
  all.set(slot, { digest, basketId });
  basketId.catch(() => all.delete(slot));
  while (all.size > MAX_REMEMBERED_KEYS) all.delete(all.keys().next().value!);
  return basketId;
}
