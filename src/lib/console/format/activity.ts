/** "sha256:1b090c55…c084a58" style truncation: first 8 and last 6 characters. */
export function shortHash(value: string | undefined): string {
  if (!value) return "–";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
