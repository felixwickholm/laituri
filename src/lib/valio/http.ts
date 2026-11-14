import type {
  RawAvailabilityResponse,
  RawPriceResponse,
  RawProductAvailability,
  RawProductPrice,
} from "./raw";

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 800;
const MAX_RETRY_DELAY_MS = 5_000;
/** The API rejects requests with more than 1000 product codes. */
export const MAX_BATCH = 1000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
}

export function configFromEnv(): UpstreamConfig | undefined {
  const apiKey = process.env.VALIO_API_KEY;
  if (!apiKey) return undefined;
  const baseUrl = process.env.VALIO_API_URL || "https://junction26.valioaimo.fi/api";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  return RETRY_DELAY_MS;
}

/** One HTTP call with a timeout and a single retry on 429 or 5xx. */
export async function call(config: UpstreamConfig, path: string, init: RequestInit = {}): Promise<unknown> {
  const url = `${config.baseUrl}${path}`;
  const headers = { "X-API-Key": config.apiKey, "content-type": "application/json", accept: "application/json" };
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "could not be reached";
      throw new UpstreamError(`The wholesaler API ${reason}.`, path);
    }
    if (response.ok) return response.json();
    if (attempt === 0 && retryable(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response)));
      continue;
    }
    throw new UpstreamError(`The wholesaler API answered ${response.status} on ${path}.`, path, response.status);
  }
}

interface ProductsBody {
  customer: string;
  requestedDate: string;
  products: string[];
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function postProducts<T>(config: UpstreamConfig, path: string, body: Omit<ProductsBody, "products">, ids: string[], pick: (json: unknown) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (const batch of chunks(ids, MAX_BATCH)) {
    const json = await call(config, path, { method: "POST", body: JSON.stringify({ ...body, products: batch }) });
    out.push(...pick(json));
  }
  return out;
}

export function fetchRawPrices(config: UpstreamConfig, ids: string[], date: string, customer: string): Promise<RawProductPrice[]> {
  return postProducts(config, "/price", { customer, requestedDate: date }, ids, (json) => (json as RawPriceResponse).products ?? []);
}

export function fetchRawAvailability(config: UpstreamConfig, ids: string[], date: string, customer: string): Promise<RawProductAvailability[]> {
  return postProducts(config, "/availability", { customer, requestedDate: date }, ids, (json) => (json as RawAvailabilityResponse).products ?? []);
}
