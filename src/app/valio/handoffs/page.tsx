import type { Metadata } from "next";
import { HandoffsScreen } from "@/components/valio/HandoffsScreen";

export const metadata: Metadata = { title: "Questions" };

export default function ValioHandoffsPage() {
  return <HandoffsScreen />;
}
