import type { Metadata } from "next";
import { AgentsScreen } from "@/components/valio/AgentsScreen";

export const metadata: Metadata = { title: "Agents", description: "The AI agents connected to Valio Aimo through Laituri, what each ordered, and a switch to suspend one." };

/** `?agent=<id>` opens that agent's sheet, so the overview can link straight to one agent. */
export default async function ValioAgentsPage({ searchParams }: PageProps<"/valio/agents">) {
  const { agent } = await searchParams;
  return <AgentsScreen initialAgent={typeof agent === "string" ? agent : undefined} />;
}
