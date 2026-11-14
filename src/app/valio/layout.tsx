import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: { template: "%s · Valio Aimo control · Laituri", default: "Valio Aimo control · Laituri" },
};

export default function ValioLayout({ children }: LayoutProps<"/valio">) {
  return <AppShell side="valio">{children}</AppShell>;
}
