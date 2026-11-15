"use client";

import { useState } from "react";
import type { Order } from "@/lib/contracts";
import { EU_ALLERGENS, KITCHEN_LABELS, SUBSTITUTION_OPTIONS } from "@/lib/console/format/mandate";
import { applyDraft, changedFields, draftOf, patchOf, type MandateDraft } from "@/lib/console/format/mandate-patch";
import { count, eurWhole, percentOf } from "@/lib/console/format/money";
import { buyerOrders } from "@/lib/console/format/orders";
import { day, longDay } from "@/lib/console/format/time";
import { weekSpend } from "@/lib/console/format/week";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { consoleStore, useConsole } from "@/lib/console/store";
import { AmountInput } from "../mandate/AmountInput";
import { AutonomyColumns } from "../mandate/AutonomyColumns";
import { Choice, Toggle } from "../mandate/fields";
import { LimitsRow, LimitsSection } from "../mandate/LimitsSection";
import { NeverBuyPicker } from "../mandate/NeverBuyPicker";
import { PickChips } from "../mandate/PickChips";
import { SignatureCard } from "../mandate/SignatureCard";
import { useMandateSignature } from "../mandate/useMandateSignature";
import { withApprover } from "../session/gate";
import { PageHeader } from "../shell/PageHeader";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";

const PARTIAL_OPTIONS: { value: "accept" | "ask"; label: string }[] = [
  { value: "accept", label: "Yes" },
  { value: "ask", label: "Ask me" },
];

const SAVED = "Saved and signed. Your agent follows the new rules now.";

/** Products in this buyer's confirmed orders: the ones the history rule lets the agent reorder alone. */
function knownProducts(orders: Order[]): number {
  return new Set(orders.filter((order) => order.status === "confirmed").flatMap((order) => order.offer.lines.map((line) => line.productId))).size;
}

/** A whole number typed into a short field, kept between `min` and `max`. */
function NumberField({ id, label, value, min, max, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (next: number) => void }) {
  return (
    <span className="value-chip">
      <input
        id={id}
        aria-label={label}
        className="num"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        size={3}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Math.round(Number(event.target.value) || 0))))}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
  );
}

/** The customer's own rules: money, allergies, the kind of kitchen, products never to buy, who decides what. */
export function MandateScreen() {
  const { mandate, orders, jwks, ready, locked } = useConsole();
  const signature = useMandateSignature(mandate, jwks);
  const base = mandate ? draftOf(mandate.mandate) : undefined;
  const [edits, setEdits] = useState<Partial<MandateDraft>>({});
  const [saving, setSaving] = useState(false);
  const now = useNow(60_000);
  const draft = base ? { ...base, ...edits } : undefined;
  const changes = base && draft ? changedFields(base, draft) : [];
  /** A limit pair that cannot be meant: nothing is signed until it is fixed. */
  const limitProblem =
    draft && draft.perOrder > draft.perWeek
      ? "The per-order limit is above the weekly limit. Lower it, or raise the weekly limit."
      : draft && (draft.perOrder <= 0 || draft.perWeek <= 0)
        ? "Limits must be above zero."
        : undefined;

  function set<K extends keyof MandateDraft>(key: K, value: MandateDraft[K]) {
    setEdits((current) => ({ ...current, [key]: value }));
  }

  async function save(anchor: HTMLElement) {
    if (!base || !draft || changes.length === 0) return;
    setSaving(true);
    try {
      const saved = await withApprover(anchor, () => consoleStore.saveMandate(patchOf(base, draft)));
      if (saved) {
        setEdits({});
        toast(SAVED);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Your rules were not saved.", "danger");
    } finally {
      setSaving(false);
    }
  }

  const date = <time suppressHydrationWarning>{longDay(now)}</time>;
  if (!mandate || !draft) {
    return (
      <div className="page">
        <PageHeader title="Your limits" meta={date} lede={locked ? LOCKED_NOTE : ready ? "Not loaded. Trying again." : "Loading…"} />
      </div>
    );
  }

  const m = mandate.mandate;
  const mine = buyerOrders(orders, mandate);
  const spent = weekSpend(mine, now);
  const used = percentOf(spent, draft.perWeek);
  const known = knownProducts(mine);
  const preview = applyDraft(m, draft);

  return (
    <div className="page limits-page">
      <PageHeader title="Your limits" meta={date} />
      <div className="mandate-layout">
        <div className="limits-sections">
          <LimitsSection id="money" title="Money" tour="limits">
            <LimitsRow label="Per order">
              <AmountInput id="per-order" label="Per-order limit" value={draft.perOrder} onChange={(value) => set("perOrder", value)} />
            </LimitsRow>
            <LimitsRow label="Per week">
              <AmountInput id="per-week" label="Weekly limit" value={draft.perWeek} onChange={(value) => set("perWeek", value)} />
            </LimitsRow>
            <div className="limits-week">
              <p>
                <strong>{eurWhole(spent)}</strong> of {eurWhole(draft.perWeek)} spent this week
              </p>
              <span
                className="meter"
                role="meter"
                aria-label="Weekly limit used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(used, 100)}
                data-tone={used >= 100 ? "danger" : used >= 80 ? "waiting" : "accent"}
              >
                <span style={{ transform: `scaleX(${Math.min(used, 100) / 100})` }} />
              </span>
            </div>
          </LimitsSection>

          <LimitsSection id="allergies" title="Allergies" line="On means never buy.">
            <PickChips label="Allergens the agent never buys" tone="never" options={EU_ALLERGENS} values={draft.allergens} onChange={(next) => set("allergens", next)} />
            <LimitsRow label="“May contain” counts as contains">
              <Toggle label="May contain counts as contains" checked={draft.blockMayContain} onChange={(next) => set("blockMayContain", next)} />
            </LimitsRow>
          </LimitsSection>

          <LimitsSection id="kitchen" title="Your kitchen" line="Every product must be:">
            <PickChips label="Labels every product must carry" tone="require" options={KITCHEN_LABELS} values={draft.requiredClaims} onChange={(next) => set("requiredClaims", next)} />
          </LimitsSection>

          <LimitsSection id="never-buy" title="Never buy">
            <NeverBuyPicker
              products={draft.neverBuyProducts}
              words={draft.neverBuyWords}
              onProducts={(next) => set("neverBuyProducts", next)}
              onWords={(next) => set("neverBuyWords", next)}
            />
          </LimitsSection>

          <LimitsSection id="decides" title="What the agent decides alone" tour="limit-tiles">
            <LimitsRow
              label="Reorder what you bought before alone"
              hint={draft.firstTimeProducts ? `You have bought ${count(known)} products before. The agent may reorder these alone.` : `You have bought ${count(known)} products before. New products are bought alone too.`}
            >
              <Toggle label="Reorder what you bought before alone, ask about new products" checked={draft.firstTimeProducts} onChange={(next) => set("firstTimeProducts", next)} />
            </LimitsRow>
            <AutonomyColumns mandate={preview} />
          </LimitsSection>

          <LimitsSection id="swaps" title="Swaps and delivery">
            <LimitsRow label="Swap when stock is short">
              <Choice label="Swaps" value={draft.substitution} options={SUBSTITUTION_OPTIONS} onChange={(next) => set("substitution", next)} />
            </LimitsRow>
            {draft.substitution !== "none" ? (
              <LimitsRow label="A swap may cost more, up to">
                <NumberField id="swap-price" label="Largest swap price rise, percent" value={draft.maxPriceIncreasePct} min={0} max={50} unit="%" onChange={(next) => set("maxPriceIncreasePct", next)} />
              </LimitsRow>
            ) : null}
            <LimitsRow label="Take part of an order">
              <Choice label="Part deliveries" value={draft.allowPartial ? "accept" : "ask"} options={PARTIAL_OPTIONS} onChange={(next) => set("allowPartial", next === "accept")} />
            </LimitsRow>
            <LimitsRow label="Ask me about a late delivery, up to">
              <NumberField id="max-delay" label="Days late, at most" value={draft.maxDelayDays} min={0} max={14} unit={draft.maxDelayDays === 1 ? " day" : " days"} onChange={(next) => set("maxDelayDays", next)} />
            </LimitsRow>
          </LimitsSection>
        </div>

        <aside className="mandate-aside" aria-label="Who signed and save">
          <div className="glass save-card" data-dirty={changes.length > 0}>
            <p className="save-status">
              <strong>{changes.length === 0 ? "No changes" : changes.length === 1 ? "1 change" : `${changes.length} changes`}</strong>
              <span>{changes.length > 0 ? `Signed as version ${m.version + 1}` : `Version ${m.version}, valid until ${day(m.validUntil)}`}</span>
            </p>
            {limitProblem ? (
              <p className="save-problem" role="alert">
                {limitProblem}
              </p>
            ) : null}
            <div className="save-actions">
              {changes.length > 0 ? (
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setEdits({})}>
                  Discard
                </button>
              ) : null}
              <button
                type="button"
                className={changes.length > 0 ? "btn btn-primary" : "btn btn-secondary"}
                disabled={changes.length === 0 || saving || limitProblem !== undefined}
                onClick={(event) => save(event.currentTarget)}
              >
                {saving ? "Saving…" : "Save and sign"}
              </button>
            </div>
          </div>
          <SignatureCard mandate={m} signature={signature} />
        </aside>
      </div>
    </div>
  );
}
