import type { Metadata } from "next";
import { DemandScreen } from "@/components/valio/DemandScreen";

export const metadata: Metadata = { title: "Demand", description: "What customers' agents asked Valio Aimo for, and the demand lost to stock, dates or rules." };

export default function ValioDemandPage() {
  return <DemandScreen />;
}
