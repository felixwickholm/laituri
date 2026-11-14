"use client";

import { Check, ChevronDown, Clock, ExternalLink, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { AssistantMenuCard, AssistantRecipeCard, AssistantShoppingCard, Recipe } from "@/lib/contracts";
import { recipeSource } from "@/lib/assistant/source";

const MONEY = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

const COURSE: Record<string, string> = { starter: "Starter", main: "Main", side: "Side", dessert: "Dessert", drink: "Drink" };
const ORDER = ["starter", "main", "side", "dessert", "drink"];

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function allergenWords(allergens: string[]): string {
  return allergens.length ? capitalise(allergens.join(", ")) : "No common allergens";
}

interface MenuProps {
  menu: AssistantMenuCard;
  focus: boolean;
  compact: boolean;
  ordering: boolean;
  disabled: boolean;
  onChoose(): void;
  onOrder(): void;
  onRecipe(id: string): void;
}

/** One menu option: the price per guest is the biggest thing on it; the focused one carries the one order button. */
export function MenuOptionCard({ menu, focus, compact, ordering, disabled, onChoose, onOrder, onRecipe }: MenuProps) {
  const problem = menu.fits.find((fit) => !fit.ok)?.sentence ?? menu.warnings[0];
  const courses = [...menu.courses].sort((a, b) => ORDER.indexOf(a.course) - ORDER.indexOf(b.course));
  return (
    <article className="as-menu" data-focus={focus} aria-label={`${menu.label}: ${menu.name}`}>
      <header className="as-menu-head">
        <span className="as-menu-label">{menu.label}</span>
        {menu.recommended ? <span className="as-menu-mark">Suggested</span> : null}
      </header>
      <h3 className="as-menu-name">{menu.name}</h3>
      <p className="as-menu-price">
        <strong>{MONEY.format(menu.costPerGuest)}</strong>
        <span>per guest</span>
      </p>
      <p className="as-menu-total">
        {WHOLE.format(menu.totalNet)} for {menu.guests} · {menu.linesToOrder} to order
      </p>
      {menu.costNote ? <p className="as-menu-total">{menu.costNote}</p> : null}
      {compact ? null : (
        <ul className="as-courses">
          {courses.map((course) => (
            <li key={`${course.course}-${course.recipeId}`}>
              <span className="as-course-kind">{COURSE[course.course]}</span>
              <button type="button" className="as-course-dish" onClick={() => onRecipe(course.recipeId)}>
                {course.name}
              </button>
              {course.source ? <span className="as-source">{course.source.attribution}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {menu.changes ? <p className="as-menu-note">{menu.changes}</p> : null}
      {problem ? (
        <p className="as-menu-warn">
          <TriangleAlert aria-hidden />
          {problem}
        </p>
      ) : (
        <p className="as-menu-ok">
          <Check aria-hidden />
          Fits your rules
        </p>
      )}
      <div className="as-menu-action">
        {focus ? (
          <button type="button" className="btn btn-primary big wide" onClick={onOrder} disabled={disabled}>
            {ordering ? "Ordering…" : "Order this menu"}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary big wide" onClick={onChoose} disabled={disabled}>
            Choose
          </button>
        )}
      </div>
    </article>
  );
}

const AVAILABILITY: Record<string, string> = { ok: "In time", short: "Part in time", missing: "Not in time" };

/** What the chosen menu needs, net of the kitchen's stock. Closed by default: the menus come first. */
export function ShoppingCard({ list }: { list: AssistantShoppingCard }) {
  const toOrder = list.lines.filter((line) => line.toOrder.amount > 0);
  const inStock = list.lines.length - toOrder.length;
  return (
    <details className="as-shopping">
      <summary>
        <span className="as-shopping-title">Shopping list</span>
        <span className="as-shopping-meta">
          {toOrder.length} to order{inStock ? ` · ${inStock} in stock` : ""} · {WHOLE.format(list.toOrderNet)}
        </span>
        <ChevronDown aria-hidden className="as-shopping-chevron" />
      </summary>
      <ul className="as-lines">
        {list.lines.map((line) => (
          <li key={line.words} data-done={line.toOrder.amount === 0} data-availability={line.availability}>
            <span className="as-line-what">
              {capitalise(line.swap ? line.swap.split(":")[0] : line.words)}
              {line.product ? <small>{line.product}</small> : null}
            </span>
            <span className="as-line-amount">
              {line.toOrder.amount > 0 ? `${NUMBER.format(line.toOrder.amount)} ${line.toOrder.unit}` : "In stock"}
            </span>
            <span className="as-line-state">{line.availability === "ok" ? (line.estNet !== undefined ? MONEY.format(line.estNet) : "") : AVAILABILITY[line.availability]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A proposed recipe: what it is, why it is proposed, its allergens and who wrote it. */
export function RecipeTile({ recipe, onOpen }: { recipe: AssistantRecipeCard; onOpen(): void }) {
  return (
    <button type="button" className="as-recipe" onClick={onOpen}>
      <span className="as-recipe-kind">
        {COURSE[recipe.course]}
        {recipe.why ? ` · ${recipe.why}` : ""}
      </span>
      <span className="as-recipe-name">{recipe.name}</span>
      <span className="as-recipe-meta">
        {recipe.minutes ? (
          <>
            <Clock aria-hidden /> {recipe.minutes} min ·{" "}
          </>
        ) : null}
        {allergenWords(recipe.allergens)}
      </span>
      {recipe.source ? <span className="as-source">{recipe.source.attribution}</span> : null}
    </button>
  );
}

/** One recipe opened in place: ingredients scaled to the guests, the method, and the source. */
export function RecipeOpen({ recipe, portions, onClose }: { recipe: Recipe; portions?: number; onClose(): void }) {
  const [serves, setServes] = useState(portions ?? recipe.serves);
  const source = recipeSource(recipe);
  const factor = serves / recipe.serves;
  return (
    <section className="as-recipe-open" aria-label={recipe.name}>
      <header>
        <h3>{recipe.name}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the recipe">
          <X aria-hidden />
        </button>
      </header>
      <p className="as-recipe-for">
        For{" "}
        <select value={serves} onChange={(event) => setServes(Number(event.target.value))} aria-label="Portions">
          {[...new Set([recipe.serves, portions ?? recipe.serves, 20, 40, 80, 120])].sort((a, b) => a - b).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>{" "}
        portions · {allergenWords(recipe.allergens)}
      </p>
      <ul className="as-ingredients">
        {recipe.ingredients.map((ingredient) => (
          <li key={ingredient.words}>
            <span>{capitalise(ingredient.words)}</span>
            <span>
              {NUMBER.format(ingredient.amount * factor)} {ingredient.unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="as-method">{recipe.method}</p>
      {source ? (
        source.url ? (
          <a className="as-source as-source-link" href={source.url} target="_blank" rel="noreferrer">
            {source.attribution}
            <ExternalLink aria-hidden />
          </a>
        ) : (
          <span className="as-source">{source.attribution}</span>
        )
      ) : null}
    </section>
  );
}
