import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { readPaper } from "@/lib/discovery/paper";
import { evidence } from "@/lib/evidence";
import { paperAbstract } from "@/lib/evidence/markdown";
import { paperJsonLd } from "@/lib/evidence/paper-ld";
import { renderPaper } from "./markdown";
import "./paper.css";

// docs/paper.md is read when the site is built; the runtime image does not carry docs/.
export const dynamic = "force-static";
export const runtime = "nodejs";

const TITLE = "Paper: an open front door for purchasing agents at Valio Aimo";
const DESCRIPTION =
  "How Laituri lets a buyer's own AI purchasing agent order from Valio Aimo at a signed fixed price inside a buyer-signed mandate: the design, each judging criterion with how to verify it, the threat table and the limits.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/paper", types: { "text/markdown": "/paper.md", "text/plain": "/llms-full.txt" } },
  openGraph: { title: `${TITLE} · Laituri`, description: DESCRIPTION, type: "article", siteName: "Laituri", locale: "en_GB", url: "/paper", images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Laituri" }] },
  twitter: { card: "summary_large_image", title: `${TITLE} · Laituri`, description: DESCRIPTION, images: ["/brand/og-image.png"] },
};

const NAV = [
  { href: "/buyer", label: "Customer" },
  { href: "/valio", label: "Valio Aimo" },
  { href: "/evidence", label: "Evidence" },
];

/** The paper from docs/paper.md, server-rendered: readable without JavaScript, by people and by agents. */
export default function PaperPage() {
  const e = evidence();
  const { nodes, headings } = renderPaper(readPaper());
  const sections = headings.filter((h) => h.depth === 2);
  const ld = paperJsonLd(e, paperAbstract(e));

  return (
    <div className="ev pp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <header className="ev-bar glass-strong">
        <Link href="/" className="ev-home" aria-label="Laituri home">
          <Wordmark />
        </Link>
        <nav className="ev-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="ev-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <div className="ev-layout">
        <nav className="ev-toc" aria-label="On this page">
          <p className="ev-toc-title">On this page</p>
          <ul>
            {sections.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
          <p className="pp-formats">
            Also as <a href="/paper.md">Markdown</a> and <a href="/llms-full.txt">plain text</a>.
          </p>
        </nav>
        <main className="ev-main pp-main" id="main">
          <article className="pp-article">{nodes}</article>
        </main>
      </div>
    </div>
  );
}
