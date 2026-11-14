import {
  Bot,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  LayoutGrid,
  PlugZap,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type Side = "buyer" | "valio";

/** Which live figure an item carries: lines that need you, open questions, or the record's state. */
export type NavSignal = "needsYou" | "questions" | "record";

export interface NavItem {
  href: string;
  label: string;
  /** The tab bar's shorter word, when the label does not fit under its icon. */
  short?: string;
  icon: LucideIcon;
  signal?: NavSignal;
  /** One of the four places on the phone's tab bar; the rest sit behind More. */
  tab?: boolean;
}

/** The places people go on each side, and nothing else. */
export const NAV: Record<Side, NavItem[]> = {
  buyer: [
    { href: "/buyer", label: "Today", icon: CalendarDays, signal: "needsYou", tab: true },
    { href: "/buyer/plan", label: "Plan an event", short: "Event", icon: UtensilsCrossed, tab: true },
    { href: "/buyer/shop", label: "Shop", icon: ShoppingBasket, tab: true },
    { href: "/buyer/orders", label: "Orders", icon: ReceiptText, tab: true },
    { href: "/buyer/mandate", label: "Your limits", icon: SlidersHorizontal },
    { href: "/buyer/log", label: "The record", icon: ScrollText, signal: "record" },
  ],
  valio: [
    { href: "/valio", label: "Overview", icon: LayoutGrid, tab: true },
    { href: "/valio/agents", label: "Agents", icon: Bot, tab: true },
    { href: "/valio/demand", label: "Demand", icon: ChartColumn, tab: true },
    { href: "/valio/handoffs", label: "Questions", icon: CircleHelp, signal: "questions", tab: true },
    { href: "/valio/audit", label: "The record", icon: ScrollText, signal: "record" },
  ],
};

/** Shared by both sides, below the side's own places. */
export const SHARED: NavItem[] = [
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/connect", label: "Connect an agent", icon: PlugZap },
];

export const SIDES: { side: Side; href: string; label: string }[] = [
  { side: "buyer", href: "/buyer", label: "Customer" },
  { side: "valio", href: "/valio", label: "Valio Aimo" },
];

/** The side's root matches only itself; deeper items match their own subtree. */
export function isActive(pathname: string, href: string, root: string): boolean {
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}
