import { appendAudit, forgetHead, verifyAuditLog } from "@/lib/audit";
import { catalog } from "@/lib/catalog";
import { now } from "@/lib/clock";
import { currentMandate, readMandate, updateMandate, type MandatePatch } from "@/lib/mandate";
import { evaluate } from "@/lib/policy/evaluate";
import { store } from "@/lib/store";
import { sha256Hex, trust } from "@/lib/trust";
import { upstream } from "@/lib/valio";
import { workspaceAudience } from "@/lib/workspace/context";
import type { Deps } from "./types";

/** The real modules, resolved on first use so the catalogue index and keys load only when needed. */
export function realDeps(): Deps {
  return {
    get catalog() {
      return catalog();
    },
    get upstream() {
      return upstream();
    },
    get trust() {
      return trust();
    },
    get store() {
      return store();
    },
    audit: { append: appendAudit, verify: verifyAuditLog, forget: forgetHead },
    policy: { evaluate },
    mandates: {
      read: readMandate,
      current: (buyerId) => currentMandate(buyerId),
      // The engine's patch type is a looser deep partial; updateMandate validates the merged result.
      update: (patch, buyerId) => updateMandate(patch as MandatePatch, buyerId),
    },
    hash: sha256Hex,
    now,
    audience: () => workspaceAudience(),
  };
}
