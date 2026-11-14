"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import { api } from "@/lib/console/api";
import type { Jwks, SignedMandate } from "@/lib/console/types";
import { SIGNED_KIND, checkSignature, hashOf, sameContent, type KeyRole, type SignedKind } from "@/lib/console/verify";

export interface SignatureRow {
  label: string;
  jws?: string;
  role: KeyRole;
  state: "checking" | "valid" | "invalid" | "missing";
  note?: string;
}

interface Proof {
  signatures: SignatureRow[];
  offerHash?: string;
  alternatives: SignedOffer[];
}

function alternativeIds(audit: AuditEntry[], offerId: string): string[] {
  const issued = audit.find((entry) => entry.event === "offer.issued" && entry.refs.offerId === offerId);
  const ids = issued?.data.alternativeOfferIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

async function row(label: string, kind: SignedKind, jws: string | undefined, jwks: Jwks | undefined, extra?: (payload: unknown) => Promise<string | undefined>): Promise<SignatureRow> {
  const { role } = SIGNED_KIND[kind];
  if (!jws) return { label, role, state: "missing" };
  const result = await checkSignature(jws, jwks, kind);
  if (!result.valid) return { label, role, jws, state: "invalid", note: result.reason };
  const problem = extra ? await extra(result.payload) : undefined;
  return problem ? { label, role, jws, state: "invalid", note: problem } : { label, role, jws, state: "valid" };
}

/** Fetches the signed offer and checks every signature on an order in this browser. */
export function useOrderProof(order: Order | undefined, jwks: Jwks | undefined, mandate: SignedMandate | undefined, audit: AuditEntry[]): Proof {
  const [proof, setProof] = useState<Proof>({ signatures: [], alternatives: [] });
  const orderKey = order ? `${order.id}:${order.status}:${order.updatedAt}` : "";
  const altKey = order ? alternativeIds(audit, order.offer.id).join(",") : "";

  useEffect(() => {
    if (!order) return;
    let live = true;
    (async () => {
      const offerHash = await hashOf(order.offer);
      const signed = await api.offer(order.offer.id).catch(() => undefined);
      const alternatives = (await Promise.all(altKey.split(",").filter(Boolean).map((id) => api.offer(id).catch(() => undefined))))
        .filter((item): item is SignedOffer => Boolean(item));
      const signatures = await Promise.all([
        row("Offer", "offer", signed?.jws, jwks, async (payload) => (sameContent(payload, order.offer) ? undefined : "The signed offer differs from this order.")),
        row("Mandate", "mandate", mandate?.jws, jwks),
        row("Approval", "approval", order.approval?.jws, jwks),
        row("Receipt", "receipt", order.receiptJws, jwks, async (payload) => {
          const claimed = (payload as { offerHash?: string } | undefined)?.offerHash;
          return claimed && claimed !== offerHash ? "The receipt names a different offer." : undefined;
        }),
      ]);
      if (live) setProof({ signatures, offerHash, alternatives });
    })();
    return () => {
      live = false;
    };
    // orderKey and altKey capture every input that changes the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, altKey, jwks, mandate?.jws]);

  return proof;
}
