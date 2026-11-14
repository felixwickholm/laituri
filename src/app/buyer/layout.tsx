import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: { template: "%s · Laituri", default: "Buyer · Laituri" },
};

export default function BuyerLayout({ children }: LayoutProps<"/buyer">) {
  return <AppShell side="buyer">{children}</AppShell>;
}
