import type { Metadata } from "next";
import { MandateScreen } from "@/components/buyer/MandateScreen";

export const metadata: Metadata = { title: "Mandate" };

export default function MandatePage() {
  return <MandateScreen />;
}
