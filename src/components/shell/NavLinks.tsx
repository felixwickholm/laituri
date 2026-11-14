"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive, type Side } from "./nav";

export interface NavSignals {
  waiting: number;
  chainBroken: boolean;
}

interface NavLinksProps {
  side: Side;
  signals: NavSignals;
  /** "list" in the sidebar, "tabs" in the phone tab bar. */
  variant: "list" | "tabs";
}

export function NavLinks({ side, signals, variant }: NavLinksProps) {
  const pathname = usePathname();
  const items = NAV[side];
  const root = items[0].href;
  return (
    <ul className={variant === "list" ? "nav-list" : "tab-list"}>
      {items.map((item) => {
        const active = isActive(pathname, item.href, root);
        const Icon = item.icon;
        const waiting = item.signal === "waiting" && signals.waiting > 0 ? signals.waiting : 0;
        const broken = item.signal === "chain" && signals.chainBroken;
        return (
          <li key={item.href}>
            <Link href={item.href} className="nav-item" aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span className="nav-label">{item.label}</span>
              {waiting ? (
                <span className="nav-count" aria-label={`${waiting} waiting for you`}>
                  {waiting}
                </span>
              ) : null}
              {broken ? <span className="nav-alarm" role="img" aria-label="The log does not verify" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
