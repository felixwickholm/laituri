"use client";

import { useEffect, useState } from "react";
import { SupplierOverview } from "@/lib/contracts";

const PATH = "/api/v1/supplier/overview";

let pending: Promise<SupplierOverview | undefined> | undefined;

/** One read of the supplier overview per page load, shared by every part of the landing page that quotes it. */
export function loadOverview(): Promise<SupplierOverview | undefined> {
  pending ??= fetch(PATH, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : undefined))
    .then((body: unknown) => {
      const parsed = SupplierOverview.safeParse(body);
      return parsed.success ? parsed.data : undefined;
    })
    .catch(() => undefined);
  return pending;
}

/** The overview once it answers; undefined while it is on its way, null when it did not answer. */
export function useOverview(): SupplierOverview | null | undefined {
  const [overview, setOverview] = useState<SupplierOverview | null>();
  useEffect(() => {
    let cancelled = false;
    void loadOverview().then((value) => {
      if (!cancelled) setOverview(value ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return overview;
}
