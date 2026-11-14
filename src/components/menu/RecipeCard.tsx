"use client";

import { ChevronDown, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { menuApi } from "@/lib/menu-console/api";
import { addDays, allergenText, amountText, capitalise, COURSE_WORD, courseOf, isoDay, recipeLines, scaleAmount } from "@/lib/menu-console/format";
import { useRecipe } from "@/lib/menu-console/hooks";
import type { RecipeSummary } from "@/lib/menu-console/types";
import { toast } from "../ui/toast";
import { CourseIcon } from "./CourseIcon";

/** One recipe: the facts a cook checks first, then the ingredients for the portions set above. */
export function RecipeCard({ recipe, portions }: { recipe: RecipeSummary; portions: number }) {
  const [open, setOpen] = useState(false);
  const course = courseOf(recipe);
  const listId = `recipe-${recipe.id}`;
  return (
    <article className="recipe-card" aria-labelledby={`${listId}-name`}>
      <header className="recipe-head">
        {course ? (
          <span className="recipe-course">
            <CourseIcon course={course} />
            {COURSE_WORD[course]}
          </span>
        ) : null}
        <h2 className="recipe-name" id={`${listId}-name`}>
          {recipe.name}
        </h2>
        {recipe.source?.url ? (
          <a className="recipe-source" href={recipe.source.url} target="_blank" rel="noreferrer">
            {recipe.source.attribution}
          </a>
        ) : recipe.source ? (
          <span className="recipe-source">{recipe.source.attribution}</span>
        ) : null}
      </header>
      <dl className="recipe-facts">
        <div>
          <dt>Serves</dt>
          <dd>{recipe.serves}</dd>
        </div>
        {recipe.minutes ? (
          <div>
            <dt>
              <Clock size={14} aria-hidden /> Time
            </dt>
            <dd>{recipe.minutes} min</dd>
          </div>
        ) : null}
        <div className="recipe-allergens">
          <dt>Allergens</dt>
          <dd>{allergenText(recipe.allergens)}</dd>
        </div>
      </dl>
      <button type="button" className="menu-see" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide the ingredients" : `Ingredients for ${portions}`}
        <ChevronDown size={18} aria-hidden />
      </button>
      {open ? <RecipeIngredients id={recipe.id} listId={listId} portions={portions} name={recipe.name} /> : null}
    </article>
  );
}

function RecipeIngredients({ id, listId, portions, name }: { id: string; listId: string; portions: number; name: string }) {
  const router = useRouter();
  const { data, loading, error, missing } = useRecipe(id);
  const [busy, setBusy] = useState(false);

  async function order(): Promise<void> {
    if (!data) return;
    setBusy(true);
    try {
      const { basketId } = await menuApi.placeBasket({
        title: `${name}, ${portions} portions`,
        deliverBy: addDays(isoDay(Date.now()), 1),
        source: "manual",
        lines: recipeLines(data, portions),
      });
      router.push(`/buyer?basket=${encodeURIComponent(basketId)}`);
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "The order did not start. Try again.", "danger");
      setBusy(false);
    }
  }

  if (loading) return <p className="recipe-wait" id={listId}>Loading the ingredients…</p>;
  if (!data) return <p className="recipe-wait" id={listId}>{missing ? "This recipe is not ready yet." : (error ?? "The ingredients did not load.")}</p>;
  return (
    <div id={listId} className="recipe-body">
      <ul className="recipe-ingredients">
        {data.ingredients.map((ingredient) => (
          <li key={ingredient.words}>
            <span>{capitalise(ingredient.words)}</span>
            <span className="recipe-amount">{amountText({ amount: scaleAmount(ingredient.amount, data.serves, portions), unit: ingredient.unit })}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary big wide" onClick={order} disabled={busy || data.ingredients.length === 0}>
        {busy ? "Ordering…" : `Order for ${portions} portions`}
      </button>
    </div>
  );
}
