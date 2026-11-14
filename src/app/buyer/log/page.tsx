import type { Metadata } from "next";
import { LogScreen } from "@/components/buyer/LogScreen";

export const metadata: Metadata = { title: "Log" };

export default function LogPage() {
  return <LogScreen />;
}
