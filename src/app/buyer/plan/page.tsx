import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/menu/PlanScreen";

export const metadata: Metadata = { title: "Plan an event", description: "Plan an event with the agent: three menus from Valio recipes for the guests' needs and the customer's limits, with a shopping list ready to order." };

export default function PlanPage() {
  return (
    <Suspense>
      <PlanScreen />
    </Suspense>
  );
}
