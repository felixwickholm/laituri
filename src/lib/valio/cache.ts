/** Small TTL cache. Uses a monotonic clock, so a pinned business clock never freezes expiry. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= performance.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.set(key, { value, expires: performance.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
