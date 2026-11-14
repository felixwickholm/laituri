"use client";

import { useState } from "react";
import { ALLERGEN_RULES, CATEGORY_LABELS, SUBSTITUTION_OPTIONS, allergenRule, categoryLabel, tiers } from "@/lib/console/format/mandate";
import { applyDraft, changedFields, draftOf, parseAmount, patchOf, type MandateDraft } from "@/lib/console/format/mandate-patch";
import { eur, percentOf } from "@/lib/console/format/money";
import { shortName } from "@/lib/console/format/rules";
import { day } from "@/lib/console/format/time";
import { weekSpend } from "@/lib/console/format/week";
import { consoleStore, useConsole } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";
import { ChipSet, Group, Row, Toggle } from "./fields";
import { Tiers } from "./Tiers";

export function MandateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mandate, orders } = useConsole();
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

  const spent = weekSpend(orders, now);
  const used = draft ? percentOf(spent, draft.perWeek) : 0;
  const m = mandate?.mandate;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker={m ? `${m.id} · version ${m.version}` : undefined}
      title="What the agent may do alone"
      lede={m ? `${m.agent.name} buys for ${m.buyer.name}. Valid until ${day(m.validUntil)}.` : "Loading the signed mandate."}
      footer={
        <>
          <span className="note">{changes.length === 0 ? "No changes" : changes.length === 1 ? "1 change" : `${changes.length} changes`}</span>
          <span className="end">
            <button type="button" className="btn" disabled={changes.length === 0 || saving} onClick={() => setEdits({})}>
              Discard
            </button>
            <button type="button" className="btn btn-primary" disabled={changes.length === 0 || saving} onClick={(event) => save(event.currentTarget)}>
              {saving ? "Signing…" : "Save mandate"}
            </button>
          </span>
        </>
      }
    >
      {m && draft ? (
        <div className="settings">
          <Tiers tiers={tiers(applyDraft(m, draft))} />
          <Group label="Spending" note={`${eur(spent)} of ${eur(draft.perWeek)} used this week.`}>
            <Row label="Per-order limit" hint="Larger orders ask a person" htmlFor="per-order">
              <span className="money-field">
                <span aria-hidden="true">€</span>
                <input id="per-order" className="text-field num" type="number" min={0} step={50} inputMode="decimal" value={draft.perOrder} onChange={(event) => set("perOrder", parseAmount(event.target.value) ?? 0)} />
              </span>
            </Row>
            <Row label="Weekly limit" htmlFor="per-week">
              <span className="money-field">
                <span aria-hidden="true">€</span>
                <input id="per-week" className="text-field num" type="number" min={0} step={100} inputMode="decimal" value={draft.perWeek} onChange={(event) => set("perWeek", parseAmount(event.target.value) ?? 0)} />
              </span>
            </Row>
            <div className="usage" role="meter" aria-label="Weekly limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(used, 100)}>
              <span style={{ transform: `scaleX(${Math.min(used, 100) / 100})` }} data-high={used > 80} />
            </div>
          </Group>
          <Group label="Allowed categories">
            <ChipSet values={draft.categories} options={CATEGORY_LABELS} labelOf={categoryLabel} onChange={(next) => set("categories", next)} addLabel="Add" />
          </Group>
          <Group label="Never buy">
            <ChipSet values={draft.allergens} options={ALLERGEN_RULES} labelOf={allergenRule} onChange={(next) => set("allergens", next)} addLabel="Add rule" />
          </Group>
          <Group label="Substitutes">
            <div className="segmented wrap" role="group" aria-label="Substitution policy">
              {SUBSTITUTION_OPTIONS.map((option) => (
                <button key={option.value} type="button" aria-pressed={draft.substitution === option.value} onClick={() => set("substitution", option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </Group>
          <Group label="Delivery">
            <Row label="Partial deliveries" hint="Otherwise a person decides">
              <Toggle label="Partial deliveries" checked={draft.allowPartial} onChange={(next) => set("allowPartial", next)} />
            </Row>
            <Row label="Days late, at most" htmlFor="max-delay">
              <input id="max-delay" className="text-field num" type="number" min={0} max={14} step={1} value={draft.maxDelayDays} onChange={(event) => set("maxDelayDays", Math.max(0, Math.round(Number(event.target.value) || 0)))} />
            </Row>
          </Group>
          <Group label="Approval">
            <Row label="Approver">
              <span className="value">{shortName(m.approval.approver.name)}</span>
            </Row>
            <Row label="Ask before new products">
              <Toggle label="Ask before new products" checked={draft.firstTimeProducts} onChange={(next) => set("firstTimeProducts", next)} />
            </Row>
          </Group>
        </div>
      ) : (
        <p className="pane-empty">The mandate is not loaded yet.</p>
      )}
    </Sheet>
  );
}
