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

/** The overview once it answers; undefined before that, or when it does not. */
export function useOverview(): SupplierOverview | undefined {
  const [overview, setOverview] = useState<SupplierOverview>();
  useEffect(() => {
    let cancelled = false;
    void loadOverview().then((value) => {
      if (!cancelled) setOverview(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return overview;
}
