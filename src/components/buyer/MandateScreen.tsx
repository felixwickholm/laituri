"use client";

import { useState } from "react";
import { ALLERGEN_RULES, CATEGORY_LABELS, SUBSTITUTION_OPTIONS, allergenRule, categoryLabel } from "@/lib/console/format/mandate";
import { changedFields, draftOf, patchOf, type MandateDraft } from "@/lib/console/format/mandate-patch";
import { eur, percentOf } from "@/lib/console/format/money";
import { buyerOrders } from "@/lib/console/format/orders";
import { shortName } from "@/lib/console/format/rules";
import { day } from "@/lib/console/format/time";
import { weekSpend } from "@/lib/console/format/week";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { consoleStore, useConsole } from "@/lib/console/store";
import { AmountInput } from "../mandate/AmountInput";
import { ChipSet, Choice, Toggle } from "../mandate/fields";
import { RuleGroup, RuleSentence } from "../mandate/RuleGroup";
import { SignatureCard } from "../mandate/SignatureCard";
import { SignatureLine } from "../mandate/SignatureLine";
import { useMandateSignature } from "../mandate/useMandateSignature";
import { withApprover } from "../session/gate";
import { PageHeader } from "../shell/PageHeader";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";

const PARTIAL_OPTIONS: { value: "accept" | "ask"; label: string }[] = [
  { value: "accept", label: "Accept" },
  { value: "ask", label: "Ask me" },
];

/** "No nuts" reads wrong after "contains any of these", so the chips name the allergen alone. */
function allergenName(id: string): string {
  return allergenRule(id).replace(/^No /, "");
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** The mandate as rules in plain sentences, with the values a person can change in place. Saving re-signs it. */
export function MandateScreen() {
  const { mandate, orders, jwks, ready, locked } = useConsole();
  const signature = useMandateSignature(mandate, jwks);
  const base = mandate ? draftOf(mandate.mandate) : undefined;
  const [edits, setEdits] = useState<Partial<MandateDraft>>({});
  const [saving, setSaving] = useState(false);
  const now = useNow(60_000);
  const draft = base ? { ...base, ...edits } : undefined;
  const changes = base && draft ? changedFields(base, draft) : [];

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
        toast(`Mandate re-signed. Version ${saved.mandate.version}.`);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "The mandate was not saved.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (!mandate || !draft) {
    return (
      <div className="page">
        <PageHeader title="Mandate" lede={locked ? LOCKED_NOTE : ready ? "The signed mandate could not be loaded. Retrying." : "Loading the signed mandate…"} />
      </div>
    );
  }

  const m = mandate.mandate;
  const spent = weekSpend(buyerOrders(orders, mandate), now);
  const used = percentOf(spent, draft.perWeek);

  return (
    <div className="page">
      <PageHeader
        title="Mandate"
        meta={`${m.agent.name} buys for ${m.buyer.name}`}
        lede={<SignatureLine state={signature} signer={m.buyer.name} version={m.version} until={day(m.validUntil)} />}
      />
      <div className="mandate-layout">
        <div className="rule-groups">
          <RuleGroup title="Allowed without asking" strength="alone" note="Inside these, your agent buys on its own. Past them, it stops and asks you.">
            <RuleSentence>
              Spend up to <AmountInput id="per-order" label="Per-order limit" value={draft.perOrder} onChange={(value) => set("perOrder", value)} /> on one order.
            </RuleSentence>
            <RuleSentence
              detail={
                <span className="usage">
                  <span className="meter" role="meter" aria-label="Weekly limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(used, 100)} data-tone={used >= 100 ? "danger" : used >= 80 ? "waiting" : "accent"}>
                    <span style={{ transform: `scaleX(${Math.min(used, 100) / 100})` }} />
                  </span>
                  {eur(spent)} used this week · {used}%
                </span>
              }
            >
              Spend up to <AmountInput id="per-week" label="Weekly limit" value={draft.perWeek} onChange={(value) => set("perWeek", value)} /> in one week.
            </RuleSentence>
            <RuleSentence detail={<ChipSet values={draft.categories} options={CATEGORY_LABELS} labelOf={categoryLabel} onChange={(next) => set("categories", next)} addLabel="Add category" />}>
              Buy from these {draft.categories.length} {draft.categories.length === 1 ? "category" : "categories"}.
            </RuleSentence>
            <RuleSentence>
              Partial deliveries:{" "}
              <Choice label="Partial deliveries" value={draft.allowPartial ? "accept" : "ask"} options={PARTIAL_OPTIONS} onChange={(next) => set("allowPartial", next === "accept")} />
            </RuleSentence>
            <RuleSentence>
              Substitutes it may pick on its own:{" "}
              <Choice label="Substitution policy" value={draft.substitution} options={SUBSTITUTION_OPTIONS} onChange={(next) => set("substitution", next)} />
            </RuleSentence>
          </RuleGroup>

          <RuleGroup title="Ask me first" strength="ask" note={`Your agent waits for ${shortName(m.approval.approver.name)} to approve or reject.`}>
            <RuleSentence>
              Any order over {eur(draft.perOrder)}, or a week over {eur(draft.perWeek)}.
            </RuleSentence>
            <RuleSentence>Products outside your {draft.categories.length} categories.</RuleSentence>
            {!draft.allowPartial ? <RuleSentence>A delivery that covers only part of the order.</RuleSentence> : null}
            <RuleSentence
              detail={
                <span className="toggle-line">
                  <Toggle label="Ask me first about products it has not ordered before" checked={draft.firstTimeProducts} onChange={(next) => set("firstTimeProducts", next)} />
                  <span className="toggle-word">{draft.firstTimeProducts ? "Ask me first: on. It waits for you." : "Ask me first: off. It buys them alone."}</span>
                </span>
              }
            >
              Products it has not ordered before.
            </RuleSentence>
            <RuleSentence>
              A delivery up to{" "}
              <input
                id="max-delay"
                aria-label="Days late, at most"
                className="value-chip num"
                type="number"
                min={0}
                max={14}
                step={1}
                value={draft.maxDelayDays}
                onChange={(event) => set("maxDelayDays", Math.max(0, Math.min(14, Math.round(Number(event.target.value) || 0))))}
              />{" "}
              {draft.maxDelayDays === 1 ? "day" : "days"} late.
            </RuleSentence>
            <RuleSentence>A substitute that costs more than {m.substitution.maxPriceIncreasePct}% over the product it replaces.</RuleSentence>
            <RuleSentence>A product it is not sure matches your request.</RuleSentence>
          </RuleGroup>

          <RuleGroup title="Never" strength="hard" note="Blocked outright. Nobody can approve these.">
            <RuleSentence detail={<ChipSet values={draft.allergens} options={ALLERGEN_RULES} labelOf={allergenName} onChange={(next) => set("allergens", next)} addLabel="Add allergen" />}>
              Buy a product that contains {draft.allergens.length === 0 ? "a listed allergen. None are listed." : "any of these:"}
            </RuleSentence>
            <RuleSentence>Accept a delivery more than {days(draft.maxDelayDays)} late.</RuleSentence>
            {draft.substitution === "none" ? <RuleSentence>Substitute a product.</RuleSentence> : null}
            <RuleSentence>Use an offer that is expired, altered, or not signed by Valio Aimo.</RuleSentence>
            <RuleSentence>Order under a mandate that is unsigned or out of date.</RuleSentence>
          </RuleGroup>
        </div>

        <aside className="mandate-aside" aria-label="Signature and changes">
          <SignatureCard mandate={m} signature={signature} />
          <div className="card save-card" data-dirty={changes.length > 0}>
            <p className="save-status">
              <strong>{changes.length === 0 ? "No changes" : changes.length === 1 ? "1 change" : `${changes.length} changes`}</strong>
              <span>{changes.length === 0 ? "Change a value in a rule, then save to re-sign." : `Saving signs version ${m.version + 1} as ${m.buyer.name}.`}</span>
            </p>
            <div className="save-actions">
              {changes.length > 0 ? (
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setEdits({})}>
                  Discard
                </button>
              ) : null}
              <button
                type="button"
                className={changes.length > 0 ? "btn btn-primary" : "btn btn-secondary"}
                disabled={changes.length === 0 || saving}
                onClick={(event) => save(event.currentTarget)}
              >
                {saving ? "Signing…" : "Save and re-sign"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
