/** Runs once when the server starts: an empty state gets about a week of demo history (see LAITURI_SEED). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedIfEmpty } = await import("@/lib/seed");
  await seedIfEmpty();
}
