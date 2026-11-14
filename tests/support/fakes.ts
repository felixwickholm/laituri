import { CompactSign, compactVerify, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { createHash } from "node:crypto";
import type { AuditEntry, Order, Product, SearchRequest, SearchResponse, SignedOffer } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { Activity, Store } from "@/lib/store/types";
import type { SignerRole, Verified } from "@/lib/trust/types";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "@/lib/valio/types";
import type { AuditInput, AuditLog } from "@/lib/orders/types";
import { AVAILABILITY, PRICES, PRODUCTS } from "./products";

export function fakeCatalog(products: Product[] = PRODUCTS): Catalog {
  const byId = new Map(products.map((product) => [product.id, product]));
  return {
    size: products.length,
    get: (id) => byId.get(id),
    search(request: SearchRequest): SearchResponse {
      const words = request.query.toLowerCase().split(/\s+/);
      const hits = products
        .filter((product) => words.some((word) => product.name.en.toLowerCase().includes(word)))
        .slice(0, request.limit ?? 10)
        .map((product) => ({ product, score: 1, matched: ["name"] }));
      return { query: request.query, interpretation: { claims: [], confidence: "high" }, hits };
    },
    substitutesFor(id, limit = 12) {
      const original = byId.get(id);
      if (!original) return [];
      return products.filter((p) => p.id !== id && p.categoryGroup === original.categoryGroup).slice(0, limit);
    },
  };
}

export class FakeUpstream implements UpstreamClient {
  calls: { kind: "price" | "availability"; ids: string[]; date: string }[] = [];
  prices = new Map(PRICES.map((p) => [p.productId, { ...p }]));
  stock = new Map(AVAILABILITY.map((a) => [a.productId, { ...a }]));
  fail = false;

  async price(ids: string[], date: string): Promise<Map<string, UpstreamPrice>> {
    this.calls.push({ kind: "price", ids, date });
    if (this.fail) throw new Error("connection refused");
    return new Map(ids.map((id) => [id, this.prices.get(id) ?? { productId: id, found: false, contractPrice: false }]));
  }

  async availability(ids: string[], date: string): Promise<Map<string, UpstreamAvailability>> {
    this.calls.push({ kind: "availability", ids, date });
    if (this.fail) throw new Error("connection refused");
    const missing = (id: string): UpstreamAvailability => ({ productId: id, deliverable: false, salesBlock: false, available: 0 });
    return new Map(ids.map((id) => [id, this.stock.get(id) ?? missing(id)]));
  }
}

/** ES256 keys per role, generated in memory. */
export class FakeTrust {
  private keys = new Map<SignerRole, Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }>>();

  private key(role: SignerRole) {
    if (!this.keys.has(role)) this.keys.set(role, generateKeyPair("ES256", { extractable: true }));
    return this.keys.get(role)!;
  }

  async sign(role: SignerRole, payload: object, options?: { typ?: string }): Promise<string> {
    const { privateKey } = await this.key(role);
    return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: "ES256", kid: role, typ: options?.typ ?? "JWT" })
      .sign(privateKey);
  }

  async verify<T>(role: SignerRole, jws: string): Promise<Verified<T>> {
    try {
      const { publicKey } = await this.key(role);
      const { payload } = await compactVerify(jws, publicKey);
      return { valid: true, payload: JSON.parse(new TextDecoder().decode(payload)) as T, keyId: role };
    } catch (error) {
      return { valid: false, reason: (error as Error).message };
    }
  }

  async jwks(role: SignerRole) {
    const { publicKey } = await this.key(role);
    return { keys: [{ ...(await exportJWK(publicKey)), kid: role }] };
  }
}

type StoredOrder = Order & { idempotencyKey?: string };

export function memoryStore(): Store {
  let offers = new Map<string, SignedOffer>();
  let orders = new Map<string, StoredOrder>();
  let audit: AuditEntry[] = [];
  let activity: Activity[] = [];
  let mandate: string | undefined;
  const after = <T extends { id: string }>(items: T[], id?: string) =>
    id ? items.slice(items.findIndex((item) => item.id === id) + 1) : [...items];
  return {
    offers: { put: async (o) => void offers.set(o.offer.id, o), get: async (id) => offers.get(id) },
    orders: {
      put: async (o) => void orders.set(o.id, o),
      get: async (id) => orders.get(id),
      byIdempotencyKey: async (key) => [...orders.values()].find((o) => o.idempotencyKey === key),
      list: async () => [...orders.values()],
    },
    audit: {
      append: async (e) => void audit.push(e),
      list: async (afterSeq) => audit.filter((e) => afterSeq === undefined || e.seq > afterSeq),
      last: async () => audit.at(-1),
      replace: async (seq, e) => void (audit = audit.map((x) => (x.seq === seq ? e : x))),
    },
    activity: { append: async (a) => void activity.push(a), list: async (id) => after(activity, id) },
    mandate: { get: async () => mandate, put: async (jws) => void (mandate = jws) },
    reset: async () => {
      offers = new Map();
      orders = new Map();
      audit = [];
      activity = [];
      mandate = undefined;
    },
  };
}

/** Collects entries in order; seq starts at 1 like the real log. */
export function fakeAudit(store: Store): AuditLog & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async append(input: AuditInput) {
      const entry: AuditEntry = {
        seq: entries.length + 1,
        at: new Date().toISOString(),
        actor: input.actor,
        event: input.event,
        summary: input.summary,
        refs: input.refs ?? {},
        data: input.data ?? {},
        prevHash: "",
        hash: String(entries.length + 1),
        signature: "",
      };
      entries.push(entry);
      await store.audit.append(entry);
      return entry;
    },
    async verify() {
      return { valid: true, entries: entries.length };
    },
  };
}

export async function sha256(value: unknown): Promise<string> {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
