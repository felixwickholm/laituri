import Link from "next/link";
import { Wordmark } from "../shell/Wordmark";
import { ThemeToggle } from "../ui/ThemeToggle";

const LINKS = [
  { href: "/buyer", label: "Buyer side", short: "Buyer" },
  { href: "/valio", label: "Valio Aimo side", short: "Valio Aimo" },
  { href: "/connect", label: "Connect an agent", short: "Connect" },
  { href: "/evidence", label: "Evidence", short: "Evidence" },
];

/** A plain bar: the name, the four places to go, the theme switch. */
export function LandingBar() {
  return (
    <header className="lp-bar">
      <Link href="/" className="lp-home" aria-label="Laituri home">
        <Wordmark />
      </Link>
      <nav className="lp-nav" aria-label="Main">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="lp-link" aria-label={link.label}>
            <span className="lp-link-long">{link.label}</span>
            <span className="lp-link-short" aria-hidden="true">
              {link.short}
            </span>
          </Link>
        ))}
      </nav>
      <ThemeToggle />
    </header>
  );
}
