import { Bot, CalendarDays, ChartColumn, LayoutGrid, ReceiptText, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";

export type Side = "buyer" | "valio";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which live figure the item carries: the approvals queue, or the log's state. */
  signal?: "waiting" | "chain";
}

export const NAV: Record<Side, NavItem[]> = {
  buyer: [
    { href: "/buyer", label: "Today", icon: CalendarDays, signal: "waiting" },
    { href: "/buyer/orders", label: "Orders", icon: ReceiptText },
    { href: "/buyer/mandate", label: "Mandate", icon: ShieldCheck },
    { href: "/buyer/log", label: "Log", icon: ScrollText, signal: "chain" },
  ],
  valio: [
    { href: "/valio", label: "Overview", icon: LayoutGrid },
    { href: "/valio/agents", label: "Agents", icon: Bot },
    { href: "/valio/demand", label: "Demand", icon: ChartColumn },
    { href: "/valio/audit", label: "Audit", icon: ScrollText },
  ],
};

export const SIDES: { side: Side; href: string; label: string }[] = [
  { side: "buyer", href: "/buyer", label: "Buyer" },
  { side: "valio", href: "/valio", label: "Valio Aimo" },
];

/** The side's root matches only itself; deeper items match their own subtree. */
export function isActive(pathname: string, href: string, root: string): boolean {
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}
