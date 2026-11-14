import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeader } from "@/components/shell/Wordmark";

export const metadata: Metadata = {
  title: "Page not found",
};

/** Any address the app does not know: the brand, one short sentence and the three ways back in. */
export default function NotFound() {
  return (
    <main className="nf">
      <Link href="/" className="brand nf-brand" aria-label="Laituri for Valio Aimo, home">
        <BrandHeader layout="row" logoHeight={40} />
      </Link>
      <div className="nf-body">
        <h1>This page is not here</h1>
        <p className="nf-line">The link may be old.</p>
        <nav className="nf-links" aria-label="Ways back">
          <Link href="/buyer" className="btn big btn-primary">
            Kitchen
          </Link>
          <Link href="/valio" className="btn big btn-secondary">
            Valio Aimo
          </Link>
          <Link href="/about" className="btn big btn-quiet">
            About Laituri
          </Link>
        </nav>
      </div>
    </main>
  );
}
