/**
 * Runs once when the server starts: an empty shared state gets about a week of demo history (see LAITURI_SEED),
 * and the seeded template every visitor's sandbox is copied from is written, so the first sandbox is instant.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedIfEmpty } = await import("@/lib/seed");
  const { sandboxTemplate } = await import("@/lib/workspace");
  await seedIfEmpty();
  await sandboxTemplate();
}
