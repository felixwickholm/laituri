import Link from "next/link";
import { BrandHeader } from "../shell/Wordmark";
import { ThemeToggle } from "../ui/ThemeToggle";

const LINKS = [
  { href: "/buyer", label: "Customer" },
  { href: "/valio", label: "Valio Aimo" },
  { href: "/security", label: "Security" },
  { href: "/connect", label: "Connect" },
];

/** As Valio Aimo's own site: a white bar with their logo leading and our product beside it. */
export function LandingBar() {
  return (
    <header className="lp-head">
      <div className="lp-bar">
        <Link href="/" className="brand lp-home" aria-label="Laituri for Valio Aimo, home">
          <BrandHeader layout="row" logoHeight={48} />
        </Link>
        <nav className="lp-nav" aria-label="Main">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="lp-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="lp-bar-end" data-tour-dock="bar">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
