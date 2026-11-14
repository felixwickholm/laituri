"use client";

import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { longDay } from "@/lib/console/format/time";
import { courseOf } from "@/lib/menu-console/format";
import { useRecipes } from "@/lib/menu-console/hooks";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { RecipeCard } from "./RecipeCard";
import { Stepper } from "./Stepper";

/** Every recipe the agent plans from, with amounts for the number of portions the person sets. */
export function RecipeLibrary() {
  const recipes = useRecipes();
  const [portions, setPortions] = useState(40);
  const [find, setFind] = useState("");
  const now = useNow(60_000);
  const words = find.trim().toLowerCase();
  const list = [...(recipes.data ?? [])].filter((recipe) => !words || recipe.name.toLowerCase().includes(words)).sort((a, b) => courseRank(courseOf(a)) - courseRank(courseOf(b)) || a.name.localeCompare(b.name));

  return (
    <div className="page plan-page">
      <Link className="text-link quiet" href="/buyer/plan">
        <ArrowLeft aria-hidden />
        Plan an event
      </Link>
      <PageHeader
        title="Recipes"
        meta={<time suppressHydrationWarning>{longDay(now)}</time>}
        actions={<Stepper label="Portions" value={portions} onChange={setPortions} step={10} unit="portions" />}
      />
      <label className="recipe-find">
        <span className="sr-only">Find a recipe</span>
        <Search size={18} aria-hidden />
        <input className="text-field" type="search" value={find} onChange={(event) => setFind(event.target.value)} placeholder="Find a recipe, for example bolognese" />
      </label>
      {recipes.loading ? (
        <p className="plan-empty" role="status">
          Loading the recipes…
        </p>
      ) : recipes.locked ? (
        <p className="plan-empty">{LOCKED_NOTE}</p>
      ) : recipes.missing ? (
        <p className="plan-empty">The recipes are not ready yet. Try again in a minute.</p>
      ) : recipes.error ? (
        <p className="plan-error" role="alert">
          {recipes.error}
        </p>
      ) : list.length === 0 ? (
        <p className="plan-empty">{words ? `No recipe matches "${find.trim()}".` : "No recipes yet."}</p>
      ) : (
        <ul className="recipe-grid">
          {list.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} portions={portions} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ORDER: string[] = ["starter", "main", "side", "dessert", "drink"];
function courseRank(course: string | undefined): number {
  const index = course ? ORDER.indexOf(course) : -1;
  return index === -1 ? ORDER.length : index;
}
