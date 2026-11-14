import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { evidence, type Check, type Requirement, type Status } from "@/lib/evidence";
import { jsonLd } from "@/lib/evidence/structured";
import { gateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TITLE = "Evidence · Laituri";
const DESCRIPTION =
  "How Laituri meets each judging criterion of the Valio Aimo challenge: what was built, where it is in the code, how to check it, and the measured test and eval results.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { types: { "application/json": "/evidence.json" } },
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
    { href: "#ev-criteria", label: "The five criteria" },
    ...criteria.map((c, index) => ({ href: `#criterion-${index + 1}`, label: c.name, sub: true })),
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

const STATUS_TEXT: Record<Status, string> = { covered: "Covered", partly: "Partly", "not built": "Not built" };

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

/** Verifies the audit log on the server while the page renders. Never throws. */
async function liveAudit(): Promise<{ text: string; ok: boolean }> {
  try {
    const result = await gateway().verifyAudit();
    return result.valid
      ? { ok: true, text: `${result.entries} entries, chain and every signature verified on this request` }
      : { ok: false, text: `Does not verify: ${result.reason ?? `entry ${result.brokenAt}`}` };
  } catch {
    return { ok: false, text: "Could not be checked on this request" };
  }
}

export default async function EvidencePage() {
  const e = evidence();
  const f = e.facts;
  const audit = await liveAudit();
  const numbers = [
    { value: `${f.tests.passed}/${f.tests.total}`, label: `tests pass, ${f.tests.files} files` },
    ...f.evals.suites.map((s) => ({ value: `${s.passed}/${s.total}`, label: `${s.name.toLowerCase()} evals` })),
    { value: String(f.mandateRules), label: "mandate rules" },
    { value: String(f.mcpTools), label: "MCP tools" },
    { value: String(f.restOperations), label: "REST operations" },
    { value: String(f.demoBuyers), label: "demo buyers" },
  ];

  return (
    <div className="ev">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(e)).replace(/</g, "\\u003c") }} />
      <header className="ev-bar">
        <Link href="/" className="ev-home" aria-label="Laituri home">
          <Wordmark />
        </Link>
        <p className="ev-tagline">The loading dock for AI agents</p>
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
      <main className="ev-main" id="main">
        <section className="ev-intro" aria-labelledby="ev-title">
          <h1 id="ev-title" className="ev-h1">
            Evidence for each judging criterion
          </h1>
          <p className="ev-lede">{e.pitch}</p>
          <p className="ev-note">
            Built for the Valio Aimo challenge &ldquo;Trusted Trade Agents&rdquo; at Junction 2026. Every number below is measured by <code className="ev-code">npm run evidence</code> from the test run and{" "}
            <code className="ev-code">evals/report.json</code>. All data is synthetic and orders are simulated; see{" "}
            <a href="#simulated" className="ev-link">
              what is simulated
            </a>
            . The same data as JSON:{" "}
            <a href="/evidence.json" className="ev-link">
              /evidence.json
            </a>
            .
          </p>
          <ul className="ev-numbers" aria-label="Measured numbers">
            {numbers.map((n) => (
              <li key={n.label}>
                <span className="ev-number">{n.value}</span>
                <span className="ev-number-label">{n.label}</span>
              </li>
            ))}
          </ul>
          <p className={`ev-live ${audit.ok ? "ev-live-ok" : "ev-live-bad"}`}>
            <span className="ev-live-dot" aria-hidden="true" />
            Audit log, checked live: {audit.text}.{" "}
            <a href="/api/v1/audit/verify" className="ev-link">
              Verify it yourself
            </a>
          </p>
        </section>

        <section className="ev-section" aria-labelledby="ev-criteria">
          <h2 id="ev-criteria" className="ev-h2">
            The five criteria
          </h2>
          <div className="ev-weights" aria-hidden="true">
            {e.criteria.map((c) => (
              <span key={c.name} style={{ flexGrow: c.weight }}>
                {c.weight}%
              </span>
            ))}
          </div>
          <ol className="ev-criteria">
            {e.criteria.map((c, index) => (
              <li key={c.name} className="ev-criterion" id={`criterion-${index + 1}`}>
                <div className="ev-criterion-head">
                  <span className="ev-weight">{c.weight}%</span>
                  <h3 className="ev-h3">{c.name}</h3>
                </div>
                <p className="ev-claim">{c.claim}</p>
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
                    <h4 className="ev-h4">Measured</h4>
                    <ul className="ev-list ev-measured">
                      {c.measured.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <h4 className="ev-h4">How to check</h4>
                    <Checks checks={c.check} />
                    <h4 className="ev-h4">Where in the code</h4>
                    <Paths paths={c.where} />
                    <h4 className="ev-h4">Known limit</h4>
                    <p className="ev-limit">{c.limit}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ev-section" aria-labelledby="ev-core">
          <h2 id="ev-core" className="ev-h2">
            The brief, requirement by requirement
          </h2>
          <h3 className="ev-h3 ev-sub">Core: the solution must enable</h3>
          <RequirementList items={e.core} />
          <h3 className="ev-h3 ev-sub">Optional directions</h3>
          <RequirementList items={e.optional} />
          <h3 className="ev-h3 ev-sub">Problems the brief asks to tackle</h3>
          <RequirementList items={e.problems} />
          <h3 className="ev-h3 ev-sub">Without exposing real systems, confidential data or the marketplace roadmap</h3>
          <RequirementList items={e.privacy} />
        </section>

        <section className="ev-section" aria-labelledby="ev-scenarios">
          <h2 id="ev-scenarios" className="ev-h2">
            Example scenarios
          </h2>
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
        </section>

        <section className="ev-section" id="simulated" aria-labelledby="ev-simulated">
          <h2 id="ev-simulated" className="ev-h2">
            Simulated, assumed and not built
          </h2>
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
        </section>

        <section className="ev-section" aria-labelledby="ev-production">
          <h2 id="ev-production" className="ev-h2">
            From demo to production
          </h2>
          <ol className="ev-steps">
            {e.production.map((step) => (
              <li key={step.step}>
                <strong>{step.step}.</strong> {step.why} <Paths paths={step.where} />
              </li>
            ))}
          </ol>
        </section>

        <section className="ev-section" aria-labelledby="ev-links">
          <h2 id="ev-links" className="ev-h2">
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
          Laituri, the loading dock for AI agents · {e.licence} licence · Built for the Valio Aimo challenge at Junction 2026. Product and company names belong to their
          owners.
        </p>
      </footer>
    </div>
  );
}
