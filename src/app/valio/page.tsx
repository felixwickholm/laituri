import type { Metadata } from "next";
import { OverviewScreen } from "@/components/valio/OverviewScreen";

export const metadata: Metadata = { title: "Overview", description: "Valio Aimo's overview in Laituri: what customers' agents bought, demand that went unserved, and what waits for a person." };

export default function ValioOverviewPage() {
  return <OverviewScreen />;
}
