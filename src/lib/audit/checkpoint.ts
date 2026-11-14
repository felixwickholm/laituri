import { now } from "@/lib/clock";
import { store } from "@/lib/store";
import { TOKEN_TYPE, trust } from "@/lib/trust";
import { GENESIS_HASH } from "./verify";

export interface Checkpoint {
  size: number;
  head: string;
  at: string;
}

/** A supplier-signed statement of the log's size and head hash, for comparison later. */
export async function checkpoint(): Promise<{ checkpoint: Checkpoint; jws: string }> {
  const last = await store().audit.last();
  const value: Checkpoint = {
    size: last ? last.seq : 0,
    head: last ? last.hash : GENESIS_HASH,
    at: now().toISOString(),
  };
  return { checkpoint: value, jws: await trust().sign("supplier", value, TOKEN_TYPE.checkpoint) };
}
