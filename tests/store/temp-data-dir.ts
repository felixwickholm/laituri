import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Import first in a test file: keys and state then go to a throwaway folder, never the real .data. */
process.env.LAITURI_DATA_DIR = mkdtempSync(path.join(tmpdir(), "laituri-test-"));
process.env.LAITURI_NOW ??= "2026-11-14T09:00:00+02:00";

export const testDataDir = process.env.LAITURI_DATA_DIR;
