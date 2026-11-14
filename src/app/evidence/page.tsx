import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { evidence, type Check, type Requirement, type Status } from "@/lib/evidence";
import { jsonLd } from "@/lib/evidence/structured";
import { gateway } from "@/lib/gateway";
import { pageDate } from "@/lib/security-console/page-date";
import { SHEET_FLOW, bonusIdeas, mustBuild, sheetName, type SheetItem } from "./sheet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TITLE = "Evidence · Laituri";
const DESCRIPTION =
  "How Laituri meets each judging criterion of the Valio Aimo challenge. What we built, where it is in the code, how to check it, and the measured results.";

export const metadata: Metadata = {
  title: "Evidence",
  description: DESCRIPTION,
  alternates: { canonical: "/evidence", types: { "application/json": "/evidence.json" } },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Laituri", locale: "en_GB" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const NAV = [
  { href: "/buyer", label: "Buyer side", short: "Buyer" },
  { href: "/valio", label: "Valio Aimo side", short: "Valio Aimo" },
  { href: "/connect", label: "Connect an agent", short: "Connect" },
];

/** The page's own table of contents: the sections, and each criterion on its own. */
function contents(criteria: { name: string }[]) {
  return [
    { href: "#ev-flow", label: "The flow" },
    { href: "#ev-criteria", label: "The five criteria" },
    ...criteria.map((c, index) => ({ href: `#criterion-${index + 1}`, label: c.name, sub: true })),
    { href: "#ev-sheet", label: "Must build and bonus ideas" },
    { href: "#ev-core", label: "The brief, line by line" },
    { href: "#ev-scenarios", label: "Example scenarios" },
    { href: "#ev-simulated", label: "Simulated and not built" },
    { href: "#ev-production", label: "From demo to production" },
    { href: "#ev-links", label: "Open it yourself" },
  ];
}

function Contents({ items }: { items: { href: string; label: string; sub?: boolean }[] }) {
  return (
    <nav className="ev-toc" aria-label="On this page">
      <p className="ev-toc-title">On this page</p>
      <ul>
        {items.map((item) => (
          <li key={item.href} data-sub={item.sub ? "" : undefined}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const STATUS_TEXT: Record<Status, string> = { covered: "Built", partly: "Partly built", "not built": "Not built" };

function StatusTag({ status }: { status: Status }) {
  return <span className={`ev-status ev-status-${status.replace(" ", "-")}`}>{STATUS_TEXT[status]}</span>;
}

function CheckItem({ check }: { check: Check }) {
  switch (check.kind) {
    case "url":
      return (
        <a href={check.value} className="ev-code ev-link">
          {check.value}
        </a>
      );
    case "eval":
      return <span className="ev-code">eval {check.value}</span>;
    default:
      return <code className="ev-code">{check.value}</code>;
  }
}

function Checks({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return null;
  return (
    <ul className="ev-inline">
      {checks.map((check) => (
        <li key={`${check.kind}:${check.value}`}>
          <CheckItem check={check} />
        </li>
      ))}
    </ul>
  );
}

function Paths({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <ul className="ev-inline">
      {paths.map((p) => (
        <li key={p}>
          <code className="ev-code">{p}</code>
        </li>
      ))}
    </ul>
  );
}

function RequirementList({ items }: { items: Requirement[] }) {
  return (
    <ul className="ev-reqs">
      {items.map((item) => (
        <li key={item.quote} className="ev-req">
          <div className="ev-req-head">
            <StatusTag status={item.status} />
            <q className="ev-quote">{item.quote}</q>
          </div>
          <p>{item.answer}</p>
          <dl className="ev-meta">
            <div>
              <dt>Where</dt>
              <dd>
                <Paths paths={item.where} />
              </dd>
            </div>
            <div>
              <dt>Check</dt>
              <dd>
                <Checks checks={item.check} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** The sheet's names, each with the evidence source's answer, where to look and how to check. */
function SheetList({ items }: { items: SheetItem[] }) {
  return (
    <ul className="ev-reqs">
      {items.map(({ name, requirement }) => (
        <li key={name} className="ev-req">
          <div className="ev-req-head">
            <StatusTag status={requirement.status} />
            <h4 className="ev-h3">{name}</h4>
          </div>
          <p>{requirement.answer}</p>
          <dl className="ev-meta">
            <div>
              <dt>Where</dt>
              <dd>
                <Paths paths={requirement.where} />
              </dd>
            </div>
            <div>
              <dt>Check</dt>
              <dd>
                <Checks checks={requirement.check} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Verifies the audit log on the server while the page renders. Never throws. */
async function liveAudit(): Promise<{ text: string; ok: boolean }> {
  try {
    const result = await gateway().verifyAudit();
    return result.valid
      ? { ok: true, text: `${result.entries} entries. Every seal checked when this page loaded` }
      : { ok: false, text: `It does not check out: ${result.reason ?? `entry ${result.brokenAt}`}` };
  } catch {
    return { ok: false, text: "It could not be checked just now" };
  }
}

export default async function EvidencePage() {
  const e = evidence();
  const f = e.facts;
  const audit = await liveAudit();
  const counts = [
    f.tests.passed === f.tests.total
      ? { value: f.tests.total.toLocaleString("en-GB"), word: "tests, all pass", ok: true }
      : { value: `${f.tests.passed}/${f.tests.total}`, word: "tests pass", ok: false },
    { value: `${f.evals.passed}/${f.evals.total}`, word: "evals pass", ok: f.evals.passed === f.evals.total },
    { value: String(f.mandateRules), word: "limit rules" },
    { value: String(f.mcpTools), word: "MCP tools" },
  ];
  const more = [
    ...f.evals.suites.map((s) => ({ label: `${s.name} evals`, value: `${s.passed}/${s.total}` })),
    { label: "Test files", value: String(f.tests.files) },
    { label: "REST operations", value: String(f.restOperations) },
    { label: "Demo kitchens", value: String(f.demoBuyers) },
  ];

  return (
    <div className="ev">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(e)).replace(/</g, "\\u003c") }} />
      <header className="ev-bar glass-strong">
        <Link href="/" className="ev-home" aria-label="Laituri home">
          <Wordmark />
        </Link>
        <nav className="ev-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="ev-nav-link" aria-label={item.label}>
              <span className="ev-long">{item.label}</span>
              <span className="ev-short" aria-hidden="true">
                {item.short}
              </span>
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <div className="ev-layout">
      <Contents items={contents(e.criteria)} />
      <main className="ev-main page" id="main">
        <header className="page-head">
          <div>
            <h1 id="ev-title">Evidence</h1>
            <p className="page-date">{pageDate()} · Valio Aimo challenge, Junction 2026</p>
          </div>
        </header>

        <section className="glass pad verdict ev-verdict" aria-labelledby="ev-verdict-title">
          <p className="verdict-label">Each criterion, with proof</p>
          <h2 id="ev-verdict-title" className="verdict-title">
            {f.evals.passed} of {f.evals.total} evals pass.
          </h2>
          <p className="verdict-line">{e.pitch}</p>
          <p className={`ev-live ${audit.ok ? "ev-live-ok" : "ev-live-bad"}`}>
            <span className="ev-live-dot" aria-hidden="true" />
            The record, checked live: {audit.text}.{" "}
            <a href="/api/v1/audit/verify" className="ev-link">
              Check it
            </a>
          </p>
          <Link href="/buyer?tour=1" className="btn btn-primary verdict-action">
            Demo walkthrough
          </Link>
        </section>

        <ul className="count-tiles" aria-label="Measured numbers">
          {counts.map((n) => (
            <li key={n.word} className="count-tile" data-tone={n.ok === undefined ? undefined : n.ok ? "success" : "danger"}>
              <span className="count-tile-number" data-long={String(n.value).length > 5 || undefined}>
                {n.value}
              </span>
              <span className="count-tile-word">{n.word}</span>
            </li>
          ))}
        </ul>

        <details className="ev-more">
          <summary>How these are measured</summary>
          <p className="ev-note">
            <code className="ev-code">npm run evidence</code> reads the test run and <code className="ev-code">evals/report.json</code>. All data is made up. Orders are
            simulated. See{" "}
            <a href="#simulated" className="ev-link">
              what is simulated
            </a>
            . As JSON:{" "}
            <a href="/evidence.json" className="ev-link">
              /evidence.json
            </a>
            .
          </p>
          <dl className="ev-assumptions">
            {more.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>

        <section className="ev-section" aria-labelledby="ev-flow">
          <h2 id="ev-flow" className="section-title">
            The flow
          </h2>
          <ol className="ev-flow">
            {SHEET_FLOW.map((item, index) => (
              <li key={item.step}>
                <a href={item.href} className="ev-flow-step glass">
                  <span className="ev-flow-n">{index + 1}</span>
                  <span className="ev-flow-name">{item.step}</span>
                  <span className="ev-flow-line">{item.line}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="ev-section" aria-labelledby="ev-criteria">
          <h2 id="ev-criteria" className="section-title">
            The five criteria
          </h2>
          <ol className="ev-criteria">
            {e.criteria.map((c, index) => (
              <li key={c.name} className="ev-criterion glass pad" id={`criterion-${index + 1}`}>
                <div className="ev-criterion-head">
                  <span className="ev-weight">{c.weight}%</span>
                  <h3 className="ev-h3">{c.name}</h3>
                  {sheetName(c) ? <span className="ev-sheet-name">Sheet: {sheetName(c)}</span> : null}
                </div>
                <p className="ev-claim">{c.claim}</p>
                <ul className="ev-list ev-measured">
                  {c.measured.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <details className="ev-proof">
                  <summary>What we built, where, how to check</summary>
                  <div className="ev-grid">
                    <div>
                      <h4 className="ev-h4">What we built</h4>
                      <ul className="ev-list">
                        {c.built.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="ev-side">
                      <h4 className="ev-h4">Check it</h4>
                      <Checks checks={c.check} />
                      <h4 className="ev-h4">In the code</h4>
                      <Paths paths={c.where} />
                      <h4 className="ev-h4">Limit</h4>
                      <p className="ev-limit">{c.limit}</p>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section className="ev-section" aria-labelledby="ev-sheet">
          <details className="ev-fold glass">
            <summary>
              <h2 id="ev-sheet" className="section-title">
                Must build and bonus ideas
              </h2>
            </summary>
            <div className="ev-fold-body">
          <h3 className="ev-h3 ev-sub">Must build</h3>
          <SheetList items={mustBuild(e.core)} />
          <h3 className="ev-h3 ev-sub">Bonus ideas</h3>
          <SheetList items={bonusIdeas(e.optional)} />
  </div>
          </details>
        </section>

        <section className="ev-section" aria-labelledby="ev-core">
          <details className="ev-fold glass">
            <summary>
              <h2 id="ev-core" className="section-title">
                The brief, line by line
              </h2>
            </summary>
            <div className="ev-fold-body">
          <h3 className="ev-h3 ev-sub">Core: what the solution must do</h3>
          <RequirementList items={e.core} />
          <h3 className="ev-h3 ev-sub">Optional ideas</h3>
          <RequirementList items={e.optional} />
          <h3 className="ev-h3 ev-sub">Problems the brief names</h3>
          <RequirementList items={e.problems} />
          <h3 className="ev-h3 ev-sub">What stays private</h3>
          <RequirementList items={e.privacy} />
  </div>
          </details>
        </section>

        <section className="ev-section" aria-labelledby="ev-scenarios">
          <details className="ev-fold glass">
            <summary>
              <h2 id="ev-scenarios" className="section-title">
                Example scenarios
              </h2>
            </summary>
            <div className="ev-fold-body">
          <ul className="ev-reqs">
            {e.scenarios.map((s) => (
              <li key={s.name} className="ev-req">
                <div className="ev-req-head">
                  <StatusTag status={s.status} />
                  <h3 className="ev-h3">{s.name}</h3>
                </div>
                <p>{s.note}</p>
                {s.where.length > 0 || s.check.length > 0 ? (
                  <dl className="ev-meta">
                    <div>
                      <dt>Where</dt>
                      <dd>
                        <Paths paths={s.where} />
                      </dd>
                    </div>
                    <div>
                      <dt>Check</dt>
                      <dd>
                        <Checks checks={s.check} />
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
  </div>
          </details>
        </section>

        <section className="ev-section" id="simulated" aria-labelledby="ev-simulated">
          <details className="ev-fold glass">
            <summary>
              <h2 id="ev-simulated" className="section-title">
                Simulated, assumed and not built
              </h2>
            </summary>
            <div className="ev-fold-body">
          <dl className="ev-assumptions">
            {e.simulated.map((a) => (
              <div key={a.topic}>
                <dt>{a.topic}</dt>
                <dd>
                  {a.text} <Paths paths={a.where} />
                </dd>
              </div>
            ))}
          </dl>
          <h3 className="ev-h3 ev-sub">Not built</h3>
          <dl className="ev-assumptions">
            {e.notBuilt.map((a) => (
              <div key={a.topic}>
                <dt>{a.topic}</dt>
                <dd>{a.text}</dd>
              </div>
            ))}
          </dl>
  </div>
          </details>
        </section>

        <section className="ev-section" aria-labelledby="ev-production">
          <details className="ev-fold glass">
            <summary>
              <h2 id="ev-production" className="section-title">
                From demo to production
              </h2>
            </summary>
            <div className="ev-fold-body">
          <ol className="ev-steps">
            {e.production.map((step) => (
              <li key={step.step}>
                <strong>{step.step}.</strong> {step.why} <Paths paths={step.where} />
              </li>
            ))}
          </ol>
  </div>
          </details>
        </section>

        <section className="ev-section" aria-labelledby="ev-links">
          <h2 id="ev-links" className="section-title">
            Open it yourself
          </h2>
          <ul className="ev-links">
            {e.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="ev-link">
                  {link.label}
                </a>
                <span>{link.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      </div>

      <footer className="ev-foot">
        <p>
          Laituri: the dock for AI agents. {e.licence} licence. Built for the Valio Aimo challenge at Junction 2026. Product and company names belong to their owners.
        </p>
      </footer>
    </div>
  );
}
