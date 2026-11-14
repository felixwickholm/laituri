import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/menu/PlanScreen";

export const metadata: Metadata = { title: "Plan an event" };

export default function PlanPage() {
  return (
    <Suspense>
      <PlanScreen />
    </Suspense>
  );
}
