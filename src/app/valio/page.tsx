import type { Metadata } from "next";
import { OverviewScreen } from "@/components/valio/OverviewScreen";

export const metadata: Metadata = { title: "Overview" };

export default function ValioOverviewPage() {
  return <OverviewScreen />;
}
