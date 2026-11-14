import Link from "next/link";
import { Wordmark } from "../shell/Wordmark";
import { ThemeToggle } from "../ui/ThemeToggle";

export function ConnectTopBar() {
  return (
    <header className="cx-top">
      <Link href="/" className="cx-home" aria-label="Laituri home">
        <Wordmark />
      </Link>
      <p className="cx-tagline">The dock for AI agents.</p>
      <nav className="cx-nav" aria-label="Sides">
        <Link href="/buyer">Customer</Link>
        <Link href="/valio">Valio Aimo</Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}
