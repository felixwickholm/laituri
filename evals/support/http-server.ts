import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dispatch } from "./router";

export interface RunningServer {
  /** For example "http://127.0.0.1:53817". */
  origin: string;
  close(): Promise<void>;
}

async function readBody(incoming: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function toRequest(incoming: IncomingMessage, origin: string, body: Buffer | undefined): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(name, item);
  }
  return new Request(new URL(incoming.url ?? "/", origin), { method: incoming.method, headers, body: body ? new Uint8Array(body) : undefined });
}

async function answer(incoming: IncomingMessage, outgoing: ServerResponse, origin: string): Promise<void> {
  try {
    const response = await dispatch(toRequest(incoming, origin, await readBody(incoming)));
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = 500;
    outgoing.end(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Serves the App Router route handlers over real HTTP on a free local port, so a client
 * reaches them exactly as an outside agent would: by URL, headers and body only.
 */
export async function serveRoutes(): Promise<RunningServer> {
  let origin = "";
  const server = createServer((incoming, outgoing) => void answer(incoming, outgoing, origin));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
