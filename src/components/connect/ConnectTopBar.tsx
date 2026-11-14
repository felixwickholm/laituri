import Link from "next/link";
import { Wordmark } from "../shell/Wordmark";
import { ThemeToggle } from "../ui/ThemeToggle";

export function ConnectTopBar() {
  return (
    <header className="cx-top">
      <Link href="/" className="cx-home" aria-label="Laituri home">
        <Wordmark />
      </Link>
      <nav className="cx-nav" aria-label="Sides">
        <Link href="/buyer">Buyer side</Link>
        <Link href="/valio">Valio Aimo side</Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}
