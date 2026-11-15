import type { Metadata } from "next";
import { LogScreen } from "@/components/buyer/LogScreen";

export const metadata: Metadata = { title: "Log", description: "The customer's signed, hash-chained record of every agent decision, verified in the browser with public keys." };

export default function LogPage() {
  return <LogScreen />;
}
