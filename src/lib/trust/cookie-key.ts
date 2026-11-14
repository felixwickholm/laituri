import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/store/data-dir";

const KEY_BYTES = 32;

// On globalThis: the proxy and every route bundle must sign and verify with one key.
const holder = globalThis as typeof globalThis & { __laituriCookieKeys?: Map<string, Buffer> };

function readKey(file: string): Buffer | undefined {
  try {
    const key = Buffer.from(readFileSync(file, "utf8").trim(), "base64url");
    return key.length === KEY_BYTES ? key : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Key file ${file} cannot be read. Delete it to create a new key.`);
  }
}

/**
 * The server's HMAC key for the workspace cookie: LAITURI_COOKIE_KEY (base64url, 32 bytes), else a random key kept in
 * the data folder, made on first use. Synchronous, so the proxy and the routes can check a cookie without waiting.
 */
export function cookieKey(): Buffer {
  const configured = process.env.LAITURI_COOKIE_KEY?.trim();
  if (configured) {
    const key = Buffer.from(configured, "base64url");
    if (key.length < KEY_BYTES) throw new Error("LAITURI_COOKIE_KEY must hold at least 32 bytes, base64url encoded.");
    return key;
  }
  const keys = (holder.__laituriCookieKeys ??= new Map());
  const file = path.join(dataDir(), "keys", "workspace-cookie.key");
  const cached = keys.get(file);
  if (cached) return cached;
  let key = readKey(file);
  if (!key) {
    const made = randomBytes(KEY_BYTES);
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      // "wx" fails when another process made the file first; that key then wins.
      writeFileSync(file, made.toString("base64url"), { flag: "wx", mode: 0o600 });
      key = made;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      key = readKey(file);
      if (!key) throw error;
    }
  }
  keys.set(file, key);
  return key;
}
