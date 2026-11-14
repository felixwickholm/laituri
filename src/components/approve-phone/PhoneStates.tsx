import { SearchX } from "lucide-react";
import Link from "next/link";
import { DockMark, Wordmark } from "../shell/Wordmark";

/** Nothing to show in this browser's workspace: the brand, one plain sentence and the way back. */
export function PhoneMissing({ embedded, what }: { embedded: boolean; what: "order" | "basket" }) {
  return (
    <main className="ph ph-missing" data-embedded={embedded}>
      <Wordmark />
      <div className="ph-empty" role="status">
        <SearchX className="ph-empty-icon" aria-hidden="true" />
        <h1>We could not find this {what}</h1>
        <p>It may be decided already.</p>
        {!embedded ? (
          <Link className="btn btn-primary big" href="/buyer">
            Go to Today
          </Link>
        ) : null}
      </div>
    </main>
  );
}

/** While it loads, the card keeps its shape so nothing jumps when it arrives. */
export function PhoneLoading({ embedded }: { embedded: boolean }) {
  return (
    <main className="ph" data-embedded={embedded} aria-busy="true">
      <header className="ph-top">
        <DockMark size={20} />
        <span className="ph-bone" style={{ width: 160 }} />
      </header>
      <div className="ph-card glass">
        <span className="ph-bone" style={{ width: 120 }} />
        <span className="ph-bone ph-bone-big" style={{ width: 200 }} />
        <span className="ph-bone ph-bone-big" style={{ width: 160 }} />
      </div>
      <p className="sr-only">Loading…</p>
    </main>
  );
}
