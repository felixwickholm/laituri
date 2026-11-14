"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  MessageCircle,
} from "lucide-react";
import { motion, useReducedMotion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import {
  basketHeading,
  groupLines,
  isOpen,
  primaryOption,
  moreOptions,
  quantity,
} from "@/lib/console/basket";
import { useBaskets } from "@/lib/console/basket-store";
import type { Basket, BasketLine } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { sharedLocked } from "@/lib/console/format/workspace";
import { useConsole } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { HandoffSheet } from "../basket/HandoffSheet";
import { StateMark } from "../basket/StateMark";
import { useResolve, type Resolver } from "../basket/useResolve";
import { SharedLock } from "../session/SharedLock";
import { DockMark } from "../shell/Wordmark";
import { PhoneSignIn } from "./PhoneSignIn";
import { PhoneLoading, PhoneMissing } from "./PhoneStates";

const SWIPE_PX = 80;
const SWIPE_SPEED = 400;

function askedText(line: BasketLine): string {
  return line.words.includes(String(line.asked.amount))
    ? line.words
    : `${quantity(line.asked)} ${line.words}`;
}

/** One orange line: the reason large, what was asked and offered, then the options as full-width buttons. */
function LineCard({
  line,
  resolver,
  signedIn,
}: {
  line: BasketLine;
  resolver: Resolver;
  signedIn: boolean;
}) {
  const primary = primaryOption(line);
  const options = [...(primary ? [primary] : []), ...moreOptions(line)];
  const busy = resolver.busy === line.id;
  const offered = [line.product?.name, line.packs].filter(Boolean).join(" · ");
  return (
    <article
      className="ph-card ph-line glass"
      data-tour="basket-line"
      data-state={line.state}
      aria-labelledby={`ph-line-${line.id}`}
    >
      <StateMark state={line.state} />
      <h2 id={`ph-line-${line.id}`} className="ph-reason-line">
        {line.reason}
      </h2>
      <dl className="ph-facts">
        <div>
          <dt>Asked</dt>
          <dd>{askedText(line)}</dd>
        </div>
        {offered ? (
          <div>
            <dt>Offered</dt>
            <dd>{offered}</dd>
          </div>
        ) : null}
        {line.net !== undefined ? (
          <div>
            <dt>Net</dt>
            <dd className="num">{eur(line.net)}</dd>
          </div>
        ) : null}
      </dl>
      {signedIn ? (
        <div className="ph-options">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              className={
                index === 0
                  ? "btn big wide btn-primary"
                  : "btn big wide btn-secondary"
              }
              data-tour={index === 0 ? "resolve" : undefined}
              disabled={busy}
              onClick={(event) =>
                void resolver.choose(line, option, event.currentTarget)
              }
            >
              <span>{busy && index === 0 ? "Saving…" : option.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="text-link ph-ask"
            onClick={() => resolver.ask(line)}
          >
            <MessageCircle aria-hidden="true" />
            Ask Valio Aimo
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** The stack of orange lines: swipe or tap through; each choice moves on to the next. */
function Stack({
  lines,
  resolver,
  signedIn,
}: {
  lines: BasketLine[];
  resolver: Resolver;
  signedIn: boolean;
}) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const at = Math.min(index, lines.length - 1);
  const line = lines[at];

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_SPEED)
      setIndex(Math.min(at + 1, lines.length - 1));
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_SPEED)
      setIndex(Math.max(at - 1, 0));
  }

  return (
    <section className="ph-stack" aria-label="Lines that need you">
      {lines.length > 1 ? (
        <div className="ph-stack-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous line"
            disabled={at === 0}
            onClick={() => setIndex(at - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="ph-stack-count num" aria-live="polite">
            {at + 1} of {lines.length}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next line"
            disabled={at >= lines.length - 1}
            onClick={() => setIndex(at + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <motion.div
        key={line.id}
        className="ph-stack-card"
        drag={reduce ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={onDragEnd}
        initial={reduce ? false : { opacity: 0, transform: "translateX(24px)" }}
        animate={{ opacity: 1, transform: "translateX(0px)" }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <LineCard line={line} resolver={resolver} signedIn={signedIn} />
      </motion.div>
    </section>
  );
}

function AllDone({ basket }: { basket: Basket }) {
  const decided = basket.lines.filter((line) => line.resolved);
  return (
    <div className="ph-card ph-result glass" data-tone="success" role="status">
      <CircleCheck className="ph-result-icon" aria-hidden="true" />
      <h2 className="ph-result-word">All done</h2>
      <p className="ph-result-line">Nothing here needs you now.</p>
      {decided.length > 0 ? (
        <ul className="ph-decided">
          {decided.map((line) => (
            <li key={line.id}>{line.resolved?.sentence}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Blocked({
  lines,
  resolver,
}: {
  lines: BasketLine[];
  resolver: Resolver;
}) {
  if (lines.length === 0) return null;
  return (
    <section className="ph-blocked" aria-labelledby="ph-blocked-title">
      <h2 id="ph-blocked-title">
        <StateMark state="red" />{" "}
        <span className="num">{count(lines.length)}</span>
      </h2>
      <ul>
        {lines.map((line) => (
          <li key={line.id} data-tour="basket-line" data-state="red">
            <span className="ph-blocked-what">{askedText(line)}</span>
            <span className="ph-blocked-why">{line.reason}</span>
            {isOpen(line) ? (
              <button
                type="button"
                className="text-link ph-ask"
                onClick={() => resolver.ask(line)}
              >
                <MessageCircle aria-hidden="true" />
                Ask Valio Aimo
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhoneBasketView({
  basket,
  embedded,
}: {
  basket: Basket;
  embedded: boolean;
}) {
  const { session } = useConsole();
  const resolver = useResolve(basket.id);
  const groups = groupLines(basket.lines);
  const waiting = groups.needsYou.filter(isOpen);
  const signedIn = session?.signedIn === true;

  return (
    <main className="ph" data-embedded={embedded}>
      <header className="ph-top">
        <DockMark size={20} />
        <div>
          <p className="ph-buyer">{basket.buyer.name}</p>
          <p className="ph-agent">{basketHeading(basket)}</p>
        </div>
      </header>
      <div className="ph-lead">
        <h1>
          {waiting.length === 0
            ? "Nothing needs you"
            : `${waiting.length === 1 ? "1 line needs" : `${waiting.length} lines need`} you`}
        </h1>
        <p>
          {count(groups.ordered.length)} ordered ·{" "}
          {count(groups.blocked.length)} blocked
        </p>
      </div>
      {waiting.length > 0 ? (
        <Stack lines={waiting} resolver={resolver} signedIn={signedIn} />
      ) : (
        <AllDone basket={basket} />
      )}
      {waiting.length > 0 && !signedIn && session ? (
        <div className="ph-dock">
          <PhoneSignIn session={session} what="line" />
        </div>
      ) : null}
      <Blocked lines={groups.blocked} resolver={resolver} />
      {!embedded ? (
        <Link
          className="text-link ph-full"
          href={`/buyer/basket/${encodeURIComponent(basket.id)}`}
        >
          See every line
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
      <HandoffSheet />
    </main>
  );
}

/** The purchasing manager's phone over one basket: the lines that need them as a short stack, the blocked ones below. */
export function PhoneBasket({
  basketId,
  embedded,
}: {
  basketId: string;
  embedded: boolean;
}) {
  const { baskets, ready } = useBaskets();
  const { session } = useConsole();
  const workspace = useWorkspace();
  const basket = baskets.find((item) => item.id === basketId);

  if (sharedLocked(workspace, session)) {
    return (
      <main className="ph" data-embedded={embedded}>
        <SharedLock role="approver" />
      </main>
    );
  }
  if (!basket)
    return ready ? (
      <PhoneMissing embedded={embedded} what="basket" />
    ) : (
      <PhoneLoading embedded={embedded} />
    );
  return <PhoneBasketView basket={basket} embedded={embedded} />;
}
