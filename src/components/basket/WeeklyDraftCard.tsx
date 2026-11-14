"use client";

import { ChevronDown, Minus, Plus, RotateCcw, ShoppingBasket, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { changeNote, cutoffText, draftRequest, quantity, weekdayOf, type DraftEdit } from "@/lib/console/basket";
import type { WeeklyDraft } from "@/lib/contracts";
import { count } from "@/lib/console/format/money";
import { placeBasket, startWeeklyOrder } from "./start";
import type { DraftState } from "./useWeeklyDraft";

const PREVIEW = 30;

/** The draft's lines, read only: the first few with how they moved since last week. */
function Preview({ draft }: { draft: WeeklyDraft }) {
  const [all, setAll] = useState(false);
  const shown = all ? draft.lines : draft.lines.slice(0, PREVIEW);
  return (
    <>
      <ul className="draft-lines">
        {shown.map((line, index) => {
          const note = changeNote(line);
          return (
            <li key={`${line.words}-${index}`} data-change={line.change}>
              <span className="draft-words">{line.words}</span>
              {note ? <span className="draft-note">{note}</span> : null}
              <span className="draft-qty num">{quantity(line.quantity)}</span>
            </li>
          );
        })}
      </ul>
      {draft.lines.length > PREVIEW ? (
        <button type="button" className="btn btn-quiet line-group-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${count(draft.lines.length)} lines`}
        </button>
      ) : null}
    </>
  );
}

/** Every line with its amount to change or a button to leave it out, then one button to send them. */
function Editor({ draft, onDone }: { draft: WeeklyDraft; onDone: () => void }) {
  const [edits, setEdits] = useState<Record<number, DraftEdit>>({});
  const [busy, setBusy] = useState(false);
  const request = draftRequest(draft, edits);

  function edit(index: number, next: DraftEdit) {
    setEdits((current) => ({ ...current, [index]: { ...current[index], ...next } }));
  }

  async function send() {
    setBusy(true);
    const id = await placeBasket(request);
    setBusy(false);
    if (id) onDone();
  }

  return (
    <div className="draft-editor">
      <ul className="draft-lines editing">
        {draft.lines.map((line, index) => {
          const state = edits[index] ?? {};
          const amount = state.amount ?? line.quantity.amount;
          const step = line.quantity.unit === "pcs" ? 1 : amount >= 100 ? 10 : 1;
          return (
            <li key={`${line.words}-${index}`} data-removed={state.removed === true}>
              <span className="draft-words">{line.words}</span>
              {state.removed ? (
                <button type="button" className="btn btn-quiet" onClick={() => edit(index, { removed: false })}>
                  <RotateCcw aria-hidden="true" />
                  Put back
                </button>
              ) : (
                <span className="draft-amount">
                  <button type="button" className="icon-btn" aria-label={`Less ${line.words}`} onClick={() => edit(index, { amount: Math.max(0, amount - step) })}>
                    <Minus aria-hidden="true" />
                  </button>
                  <input
                    className="draft-input num"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    aria-label={`${line.words}, ${line.quantity.unit}`}
                    value={amount}
                    onChange={(event) => edit(index, { amount: Math.max(0, Number(event.target.value) || 0) })}
                  />
                  <span className="draft-unit">{line.quantity.unit}</span>
                  <button type="button" className="icon-btn" aria-label={`More ${line.words}`} onClick={() => edit(index, { amount: amount + step })}>
                    <Plus aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Leave out ${line.words}`} onClick={() => edit(index, { removed: true })}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="draft-actions">
        <button type="button" className="btn btn-primary big" data-tour="start-weekly" disabled={busy || request.lines.length === 0} onClick={() => void send()}>
          {busy ? "Starting…" : `Order these ${count(request.lines.length)} lines`}
        </button>
        <button type="button" className="btn btn-quiet big" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const DRAFT_TILES = [
  { change: "same", word: "Same" },
  { change: "more", word: "More" },
  { change: "less", word: "Less" },
  { change: "new", word: "New" },
] as const;

/** Before any basket this week: the agent's draft as a verdict, one big button, the counts by change, the lines behind a toggle. */
export function WeeklyDraftCard({ state }: { state: DraftState }) {
  const [editing, setEditing] = useState(false);
  const [showLines, setShowLines] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    await startWeeklyOrder();
    setBusy(false);
  }

  const go = (
    <button type="button" className="btn btn-primary verdict-action draft-go" data-tour="start-weekly" disabled={busy} onClick={() => void start()}>
      <ShoppingBasket aria-hidden="true" />
      {busy ? "Starting…" : "Order this week’s lines"}
    </button>
  );

  if (state.status !== "ready") {
    return (
      <section className="glass pad weekly-verdict draft-card" aria-busy={state.status === "loading"}>
        <div className="weekly-verdict-top">
          <div className="verdict">
            <p className="verdict-label">Weekly order</p>
            <h2 className="verdict-title">{state.status === "loading" ? "Getting it ready…" : "Not ready yet."}</h2>
          </div>
          <div className="weekly-verdict-actions">{go}</div>
        </div>
      </section>
    );
  }

  const { draft } = state;
  const closes = cutoffText(draft.cutoff);
  return (
    <section className="glass pad weekly-verdict draft-card" aria-labelledby="draft-title">
      <div className="weekly-verdict-top">
        <div className="verdict">
          <p className="verdict-label">
            Weekly order for {weekdayOf(draft.deliverBy)}
            {closes ? ` · closes ${closes}` : ""}
          </p>
          <h2 id="draft-title" className="verdict-title">
            {count(draft.lines.length)} lines ready.
          </h2>
        </div>
        {editing ? null : (
          <div className="weekly-verdict-actions">
            {go}
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
              Change lines
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <Editor draft={draft} onDone={() => setEditing(false)} />
      ) : (
        <>
          <ul className="count-tiles weekly-tiles">
            {DRAFT_TILES.map((tile) => (
              <li key={tile.change} className="count-tile" data-change={tile.change}>
                <span className="count-tile-number">{count(draft.lines.filter((line) => line.change === tile.change).length)}</span>
                <span className="count-tile-word">{tile.word}</span>
              </li>
            ))}
          </ul>
          {draft.drift.length > 0 ? (
            <ul className="draft-drift">
              {draft.drift.map((item) => (
                <li key={item.sentence}>
                  <TrendingUp aria-hidden="true" />
                  {item.sentence}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="weekly-foot">
            <button type="button" className="weekly-more" aria-expanded={showLines} onClick={() => setShowLines(!showLines)}>
              <ChevronDown aria-hidden="true" data-open={showLines} />
              {count(draft.lines.length)} lines
            </button>
          </div>
          {showLines ? <Preview draft={draft} /> : null}
        </>
      )}
    </section>
  );
}
