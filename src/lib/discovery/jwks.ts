import type { JWK } from "jose";
import { jwks, ROLES, type SignerRole } from "@/lib/trust";

export type RoleJwk = JWK & { use: "sig"; role: SignerRole };

/** Public keys of every signing role. supplier signs offers, receipts and audit entries; buyer signs mandates; approver signs approvals. */
export async function publicKeySet(roles: readonly SignerRole[] = ROLES): Promise<{ keys: RoleJwk[] }> {
  const sets = await Promise.all(roles.map(async (role) => ({ role, set: await jwks(role) })));
  return {
    keys: sets.flatMap(({ role, set }) => set.keys.map((key) => ({ ...key, use: "sig" as const, role }))),
  };
}
