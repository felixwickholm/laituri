import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/Wordmark";

export const metadata: Metadata = {
  title: "Page not found · Laituri",
};

/** Any address the app does not know: the brand, one calm sentence and the three ways back in. */
export default function NotFound() {
  return (
    <main className="nf">
      <Link href="/" className="brand nf-brand" aria-label="Laituri home">
        <Wordmark />
      </Link>
      <div className="nf-body">
        <h1>This page is not on the dock</h1>
        <p className="nf-line">The link may be old, or the address has a typo. Pick a side to carry on.</p>
        <nav className="nf-links" aria-label="Ways back">
          <Link href="/buyer" className="btn big btn-primary">
            Buyer side
          </Link>
          <Link href="/valio" className="btn big btn-secondary">
            Valio Aimo’s side
          </Link>
          <Link href="/" className="btn big btn-quiet">
            Home
          </Link>
        </nav>
      </div>
    </main>
  );
}
