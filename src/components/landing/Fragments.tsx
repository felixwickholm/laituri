import { CircleAlert, CircleCheck, Lock, Minus, Plus, ShieldCheck, Smartphone, TrendingUp, UtensilsCrossed } from "lucide-react";
import { STATE_ICON } from "../basket/StateMark";

/**
 * Crops of the product's own screens for the landing page, drawn with the same parts and words. Each is marked
 * "Example": the numbers are a sample of what the live demo shows, not a record.
 */

function ExampleTag() {
  return <span className="lp-ex-tag">Example</span>;
}

const DRAFT = [
  { words: "Lactose-free milk", amount: "1,000 l", note: "Same as last week" },
  { words: "Eggs", amount: "36 kg", note: "Same as last week" },
  { words: "Potatoes", amount: "100 kg", note: "20 kg more than last week", up: true },
  { words: "Cooking cream", amount: "40 l", note: "Same as last week" },
];

/** Today's draft of the standing weekly order: last week's lines, how they moved, and the one button. */
export function DraftFragment() {
  return (
    <div className="lp-frag" data-ui="draft" inert>
      <div className="lp-frag-head">
        <ExampleTag />
        <span className="lp-frag-title">Weekly order for Monday · 20 lines</span>
      </div>
      <ul className="lp-draft">
        {DRAFT.map((line) => (
          <li key={line.words}>
            <span className="lp-draft-words">{line.words}</span>
            <span className="lp-draft-note" data-up={line.up === true}>
              {line.up ? <TrendingUp aria-hidden="true" /> : null}
              {line.note}
            </span>
            <span className="lp-draft-amount">
              <Minus aria-hidden="true" />
              {line.amount}
              <Plus aria-hidden="true" />
            </span>
          </li>
        ))}
      </ul>
      <span className="btn btn-primary big lp-frag-go">Start the weekly order</span>
    </div>
  );
}

const MENUS = [
  { tier: "Good", name: "Classic dinner", per: "€14.20", fits: true },
  { tier: "Better", name: "Nordic three courses", per: "€18.90", fits: true },
  { tier: "Best", name: "Wedding dinner", per: "€24.50", fits: true },
];

/** The event planner's answer: what it understood, three menus, and that each one fits the kitchen's rules. */
export function MenuFragment() {
  return (
    <div className="lp-frag" data-ui="menu" inert>
      <div className="lp-frag-head">
        <ExampleTag />
        <span className="lp-frag-title">
          <UtensilsCrossed aria-hidden="true" />
          “A wedding for 80 on Friday, no nuts.”
        </span>
      </div>
      <p className="lp-menu-understood">80 guests, Friday 20 Nov, a seated dinner, no nuts.</p>
      <ul className="lp-menus">
        {MENUS.map((menu) => (
          <li key={menu.tier} data-tier={menu.tier.toLowerCase()}>
            <span className="lp-menu-tier">{menu.tier}</span>
            <span className="lp-menu-name">{menu.name}</span>
            <span className="lp-menu-per">
              {menu.per}
              <span> per guest</span>
            </span>
            <span className="lp-menu-fit">
              <CircleCheck aria-hidden="true" />
              No nuts in any dish
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The purchasing manager's phone: one line that needs a person, its reason large, and one tap. */
export function PhoneFragment() {
  return (
    <div className="lp-phone" data-ui="phone" inert>
      <div className="lp-phone-screen">
        <div className="lp-frag-head">
          <ExampleTag />
          <span className="lp-frag-title">
            <Smartphone aria-hidden="true" />1 of 2 lines
          </span>
        </div>
        <span className="state-mark" data-state="orange">
          <CircleAlert className="state-mark-icon" aria-hidden="true" />
          <span className="state-mark-word">Needs you</span>
        </span>
        <p className="lp-phone-reason">€116 over your limit for one order.</p>
        <p className="lp-phone-what">1,600 l lactose-free milk · Monday</p>
        <span className="btn btn-primary big lp-frag-go">Approve</span>
        <span className="btn btn-secondary big lp-frag-go">Order 1,500 l now</span>
      </div>
    </div>
  );
}

const ATTEMPTS = [
  { tried: "Buy a product with nuts.", caught: "Your rules say no nuts." },
  { tried: "Lower a fixed price.", caught: "Valio Aimo’s seal no longer fits." },
  { tried: "Raise its own limit.", caught: "Your seal on the limits no longer fits." },
  { tried: "Approve its own order.", caught: "Only a person can approve." },
  { tried: "Change the record afterwards.", caught: "The record’s seal breaks at once." },
];

/** The agent's five tries to break the rules, each stopped, and the record's seal. */
export function SafeFragment() {
  const Blocked = STATE_ICON.red;
  return (
    <div className="lp-safe" data-ui="security">
      <ol className="lp-attempts">
        {ATTEMPTS.map((attempt) => (
          <li key={attempt.tried}>
            <Blocked className="lp-attempt-icon" aria-hidden="true" />
            <span className="lp-attempt-tried">{attempt.tried}</span>
            <span className="lp-attempt-caught">Stopped. {attempt.caught}</span>
          </li>
        ))}
      </ol>
      <div className="lp-seal">
        <ShieldCheck aria-hidden="true" />
        <p>
          <strong>The record checks out.</strong>
          <span>Every step is sealed. Your own device checks it.</span>
        </p>
      </div>
    </div>
  );
}

const PRODUCTS = [
  { name: "Lactose-free milk drink 1 l", tag: "In stock", price: "€1.01" },
  { name: "Cooking cream 15% 2 l", tag: "In stock", price: "€6.48" },
  { name: "Butter 500 g", tag: "New", price: "€4.20" },
];

/** A row of the shop: the same products, prices and stock a person and an agent both see. */
export function ShopFragment() {
  return (
    <div className="lp-frag" data-ui="shop" inert>
      <div className="lp-frag-head">
        <ExampleTag />
        <span className="lp-frag-title">
          <Lock aria-hidden="true" />
          Fixed prices for your kitchen
        </span>
      </div>
      <ul className="lp-shop">
        {PRODUCTS.map((product) => (
          <li key={product.name}>
            <span className="lp-shop-tag" data-new={product.tag === "New"}>
              {product.tag}
            </span>
            <span className="lp-shop-name">{product.name}</span>
            <span className="lp-shop-price">{product.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
