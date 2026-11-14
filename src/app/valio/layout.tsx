import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: { template: "%s · Valio Aimo control · Laituri", default: "Valio Aimo control · Laituri" },
  description:
    "What Valio Aimo sees about its customers' purchasing agents: connected agents and their calls, orders, demand it could not meet, questions for a person, and the signed record. An agent can be suspended here.",
};

export default function ValioLayout({ children }: LayoutProps<"/valio">) {
  return <AppShell side="valio">{children}</AppShell>;
}
