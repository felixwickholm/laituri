import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, type CryptoKey, type JWK } from "jose";
import { dataDir } from "@/lib/store/data-dir";
import { ALG } from "./jws";
import type { SignerRole } from "./types";

export const ROLES: readonly SignerRole[] = ["supplier", "buyer", "approver"];

export interface RoleKey {
  role: SignerRole;
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JWK;
}

type KeyCache = Map<string, Promise<RoleKey>>;
const globalKeys = globalThis as typeof globalThis & { __laituriKeys?: KeyCache };

/** Loads the role's key, creating it on first use. Concurrent callers share one promise. */
export function roleKey(role: SignerRole): Promise<RoleKey> {
  const cache = (globalKeys.__laituriKeys ??= new Map());
  const file = path.join(dataDir(), "keys", `${role}.json`);
  let pending = cache.get(file);
  if (!pending) {
    pending = loadOrCreate(role, file);
    cache.set(file, pending);
    pending.catch(() => cache.delete(file));
  }
  return pending;
}

async function loadOrCreate(role: SignerRole, file: string): Promise<RoleKey> {
  const existing = await readJwk(file);
  if (existing) return fromJwk(role, existing);

  const { privateKey } = await generateKeyPair(ALG, { extractable: true });
  const jwk = await exportJWK(privateKey);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    // "wx" fails when another process created the file first; that key then wins.
    await writeFile(file, JSON.stringify(jwk, null, 2), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const winner = await readJwk(file);
    if (winner) return fromJwk(role, winner);
    throw error;
  }
  return fromJwk(role, jwk);
}

async function readJwk(file: string): Promise<JWK | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as JWK;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Key file ${file} cannot be read. Delete it to create a new key.`);
  }
}

async function fromJwk(role: SignerRole, jwk: JWK): Promise<RoleKey> {
  const publicJwk: JWK = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const kid = await calculateJwkThumbprint(publicJwk, "sha256");
  const privateKey = (await importJWK({ ...jwk, alg: ALG }, ALG)) as CryptoKey;
  const publicKey = (await importJWK({ ...publicJwk, alg: ALG }, ALG)) as CryptoKey;
  return { role, kid, privateKey, publicKey, publicJwk: { ...publicJwk, kid, alg: ALG, use: "sig" } };
}
