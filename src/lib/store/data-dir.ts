import path from "node:path";

/** Root for keys and run state. LAITURI_DATA_DIR lets tests and scripts use a separate folder. */
export function dataDir(): string {
  return path.resolve(process.env.LAITURI_DATA_DIR ?? ".data");
}
