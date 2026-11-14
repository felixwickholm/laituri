import { PayloadTooLargeError } from "@/lib/gateway/errors";

function tooLarge(maxBytes: number): PayloadTooLargeError {
  return new PayloadTooLargeError(`The request body is larger than ${Math.floor(maxBytes / 1024)} KB.`);
}

/**
 * The request body, at most `maxBytes`. A Content-Length over the cap is refused before anything is read; a body
 * without one is read chunk by chunk and refused as soon as it passes the cap, so a large upload is never buffered.
 */
export async function readCappedBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** The request body as UTF-8 text, at most `maxBytes`. */
export async function readCappedText(request: Request, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readCappedBytes(request, maxBytes));
}
