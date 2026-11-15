"use client";

import { useState, type FormEvent } from "react";
import { addDays, isoDay } from "@/lib/menu-console/format";
import type { PlanDetails } from "@/lib/menu-console/types";
import { useNow } from "../ui/useNow";
import { Stepper } from "./Stepper";

const DIETARY = [
  { id: "nut_free", label: "No nuts" },
  { id: "sesame_free", label: "No sesame" },
  { id: "lactose_free", label: "Lactose free" },
  { id: "gluten_free", label: "Gluten free" },
  { id: "vegetarian", label: "Vegetarian" },
];

/** The quiet structured way in: guests, day, dietary needs and a budget per guest. */
export function DetailsForm({ initial, onPlan }: { initial?: PlanDetails; onPlan: (details: PlanDetails) => void }) {
  const [guests, setGuests] = useState(initial?.guests ?? 80);
  const [guestsValid, setGuestsValid] = useState(true);
  const [date, setDate] = useState(() => initial?.date ?? addDays(isoDay(Date.now()), 7));
  const now = useNow(60_000);
  const [dietary, setDietary] = useState<string[]>(initial?.dietary ?? []);
  const [budget, setBudget] = useState(initial?.budgetPerGuest ? String(initial.budgetPerGuest) : "");

  function toggle(id: string): void {
    setDietary((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (!guestsValid) return;
    const details: PlanDetails = { guests, date, dietary };
    const perGuest = Number(budget.replace(",", "."));
    if (budget && Number.isFinite(perGuest) && perGuest > 0) details.budgetPerGuest = perGuest;
    onPlan(details);
  }

  return (
    <form className="details" onSubmit={submit}>
      <div className="details-row">
        <span className="details-label">
          Guests
        </span>
        <Stepper label="Guests" value={guests} onChange={setGuests} step={5} unit="guests" onValidity={setGuestsValid} />
      </div>
      {guestsValid ? null : (
        <p className="save-problem" role="alert">
          Enter a guest count from 1 to 2,000.
        </p>
      )}
      <label className="details-row">
        <span className="details-label">Day</span>
        <input className="text-field details-date" type="date" value={date} min={isoDay(now)} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <fieldset className="details-row">
        <legend className="details-label">Dietary needs</legend>
        <div className="details-diet">
          {DIETARY.map((item) => (
            <button key={item.id} type="button" className="diet-toggle" aria-pressed={dietary.includes(item.id)} onClick={() => toggle(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="details-row">
        <span className="details-label">Budget per guest</span>
        <span className="details-money">
          <span aria-hidden>€</span>
          <input className="text-field" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Any" />
        </span>
      </label>
      <button type="submit" className="btn btn-primary big" disabled={!guestsValid}>
        Plan the menu
      </button>
    </form>
  );
}
