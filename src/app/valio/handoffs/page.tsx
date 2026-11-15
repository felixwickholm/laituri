import type { Metadata } from "next";
import { HandoffsScreen } from "@/components/valio/HandoffsScreen";

export const metadata: Metadata = { title: "Questions", description: "Questions customers' agents handed to a person at Valio Aimo." };

export default function ValioHandoffsPage() {
  return <HandoffsScreen />;
}
