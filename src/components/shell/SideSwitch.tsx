import Link from "next/link";
import { SIDES, type Side } from "./nav";

/** The two sides of Laituri as one segmented pill. The active side is filled; the other is one press away. */
export function SideSwitch({ side }: { side: Side }) {
  return (
    <nav className="side-switch" aria-label="Choose a side" data-side={side}>
      <span className="side-switch-thumb" aria-hidden="true" />
      {SIDES.map((item) => (
        <Link key={item.side} href={item.href} aria-current={item.side === side ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
