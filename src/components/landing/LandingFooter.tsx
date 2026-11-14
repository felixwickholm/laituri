import Link from "next/link";

const STANDARDS = "MCP, OpenAPI 3.1, JWS/JWKS, AP2-shaped mandate, UCP terms, Peppol response codes, GS1 GTIN";

/** The close: the name at full width, the standards it is built on, the licence. */
export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <p className="lp-footer-name" aria-hidden="true">
        Laituri
      </p>
      <div className="lp-footer-grid">
        <p className="lp-footer-line">The loading dock for AI agents. Laituri is Finnish for pier.</p>
        <dl className="lp-footer-facts">
          <div>
            <dt>Open standards</dt>
            <dd>{STANDARDS}</dd>
          </div>
          <div>
            <dt>Licence</dt>
            <dd>MIT</dd>
          </div>
          <div>
            <dt>Built with</dt>
            <dd>Next.js, TypeScript, Model Context Protocol</dd>
          </div>
        </dl>
        <nav className="lp-footer-nav" aria-label="Footer">
          <Link href="/buyer">Buyer side</Link>
          <Link href="/valio">Valio Aimo side</Link>
          <Link href="/connect">Connect an agent</Link>
          <Link href="/evidence">Evidence</Link>
        </nav>
      </div>
      <p className="lp-footer-made">Built for the Valio Aimo challenge · Junction 2026</p>
    </footer>
  );
}
