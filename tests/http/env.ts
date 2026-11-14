import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Import first: deterministic clock, recorded upstream, throwaway data folder. */
process.env.VALIO_MODE = "recorded";
process.env.LAITURI_NOW = "2026-11-14T09:00:00+02:00";
process.env.LAITURI_DATA_DIR = mkdtempSync(path.join(tmpdir(), "laituri-http-"));

export const AGENT_TOKEN = "demo-agent-token";
export const BASE = "http://localhost:3299";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function jsonRequest(pathname: string, init: RequestOptions = {}): Request {
  const body = init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  return new Request(BASE + pathname, {
    method: init.method ?? (body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", ...init.headers },
    body,
  });
}

export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
