"use client";

import { useEffect, useState } from "react";
import type { Jwks, SignedMandate } from "@/lib/console/types";
import { checkSignature } from "@/lib/console/verify";

export type SignatureState = "checking" | "valid" | "invalid";

/** Checks the buyer's signature on the mandate in this browser, again whenever it is re-signed. */
export function useMandateSignature(mandate: SignedMandate | undefined, jwks: Jwks | undefined): SignatureState {
  const [result, setResult] = useState<{ jws: string; state: SignatureState } | undefined>();
  const jws = mandate?.jws;

  useEffect(() => {
    if (!jws || !jwks) return;
    let live = true;
    void checkSignature(jws, jwks, "buyer").then((check) => {
      if (live) setResult({ jws, state: check.valid ? "valid" : "invalid" });
    });
    return () => {
      live = false;
    };
  }, [jws, jwks]);

  return result && result.jws === jws ? result.state : "checking";
}
