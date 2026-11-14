import type { Metadata } from "next";
import { DemandScreen } from "@/components/valio/DemandScreen";

export const metadata: Metadata = { title: "Demand" };

export default function ValioDemandPage() {
  return <DemandScreen />;
}
