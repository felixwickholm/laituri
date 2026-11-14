import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: { template: "%s · Laituri", default: "Customer · Laituri" },
  description:
    "The customer's side of Laituri: the purchasing agent's weekly order line by line, orders waiting for a person, the customer's own limits, event planning with Valio recipes, and the signed record.",
};

export default function BuyerLayout({ children }: LayoutProps<"/buyer">) {
  return <AppShell side="buyer">{children}</AppShell>;
}
