import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { HONEST_LINE, NAME_LINE, TAGLINE } from "../shell/brand-copy";
import { ValioAimoLogo } from "../shell/Wordmark";

const LINKS = [
  { href: "/buyer", label: "The customer’s side" },
  { href: "/valio", label: "Valio Aimo’s side" },
  { href: "/security", label: "Security" },
  { href: "/connect", label: "Connect an agent" },
  { href: "/evidence", label: "Evidence" },
  { href: "/paper", label: "Paper" },
];

/** A petrol close with lime links, as Valio Aimo's own footer, and the honest line about what this is. */
export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-top">
          <p className="lp-footer-name">{NAME_LINE}</p>
          <nav className="lp-footer-nav" aria-label="Footer">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <ChevronRight aria-hidden="true" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="lp-footer-tag">{TAGLINE}</p>
        <div className="lp-footer-foot">
          <ValioAimoLogo height={36} />
          <p>{HONEST_LINE} Open source under the MIT licence.</p>
        </div>
      </div>
    </footer>
  );
}
