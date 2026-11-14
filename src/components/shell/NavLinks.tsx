"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, type NavItem } from "./nav";
import type { NavSignals } from "./signals";

interface NavLinksProps {
  items: readonly NavItem[];
  /** The side's home, which matches only itself. */
  root: string;
  signals: NavSignals;
  /** "list" in the sidebar and the More sheet, "tabs" in the phone tab bar. */
  variant: "list" | "tabs";
}

function Badge({ item, signals }: { item: NavItem; signals: NavSignals }) {
  if (item.signal === "record") return signals.recordBroken ? <span className="nav-alarm" role="img" aria-label="The record does not check out" /> : null;
  const count = item.signal === "needsYou" ? signals.needsYou : item.signal === "questions" ? signals.questions : 0;
  if (count === 0) return null;
  return (
    <span className="nav-count" aria-label={item.signal === "needsYou" ? `${count} need you` : `${count} open`}>
      {count}
    </span>
  );
}

export function NavLinks({ items, root, signals, variant }: NavLinksProps) {
  const pathname = usePathname();
  return (
    <ul className={variant === "list" ? "nav-list" : "tab-list"}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link href={item.href} className="nav-item" aria-current={isActive(pathname, item.href, root) ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span className="nav-label">{variant === "tabs" ? (item.short ?? item.label) : item.label}</span>
              <Badge item={item} signals={signals} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
