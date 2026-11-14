import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import path from "node:path";

/** A snapshot that could not be read at start-up, kept aside under another name instead of being overwritten. */
export interface Recovery {
  /** Where the unreadable file now is. */
  keptAs: string;
  reason: string;
  at: string;
}

/** Reads a JSON snapshot. Undefined when there is none; an unreadable file is renamed aside and reported. */
export function readSnapshot(file: string): { value?: unknown; recovery?: Recovery } {
  if (!existsSync(file)) return {};
  try {
    return { value: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    const at = new Date();
    const keptAs = `${file}.unreadable-${at.getTime()}`;
    renameSync(file, keptAs);
    return { recovery: { keptAs, reason: (error as Error).message, at: at.toISOString() } };
  }
}

/** Writes the whole snapshot atomically: a temporary file, flushed to disk, then renamed over the old one. */
export function writeSnapshot(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, JSON.stringify(value));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}
