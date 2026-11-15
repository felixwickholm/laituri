import type { Metadata } from "next";
import { MandateScreen } from "@/components/buyer/MandateScreen";

export const metadata: Metadata = { title: "Mandate", description: "The customer's limits (the signed mandate): money limits, allergens, food types and how much the agent may decide alone." };

export default function MandatePage() {
  return <MandateScreen />;
}
