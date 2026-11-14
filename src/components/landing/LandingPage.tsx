import { PRIMARY_BUYER_ID } from "@/lib/mandate";
import { OneLineCommand } from "../connect/OneLineCommand";
import { Tour } from "../tour/Tour";
import { Toaster } from "../ui/toast";
import { Criteria } from "./Criteria";
import { DemandFragment } from "./DemandFragment";
import { FlowBand } from "./FlowBand";
import { DraftFragment, MenuFragment, PhoneFragment, SafeFragment, ShopFragment } from "./Fragments";
import { Hero } from "./Hero";
import { LandingBar } from "./LandingBar";
import { LandingFooter } from "./LandingFooter";
import { Showcase } from "./Showcase";

/** The public front page: one line, the flow, then each claim beside a real piece of the product. */
export function LandingPage() {
  return (
    <div className="lp">
      <LandingBar />
      <main id="main">
        <Hero />
        <FlowBand />
        <Showcase
          id="lp-week"
          band="plain"
          title="Order the week in one tap"
          line="Last week’s order comes back as a draft. One tap sends it."
          link={{ href: "/buyer", label: "Open Today" }}
        >
          <DraftFragment />
        </Showcase>
        <Showcase
          id="lp-event"
          band="lilac"
          flip
          title="Plan an event in one sentence"
          line="Say the guests and the day. Get three menus and the shopping list."
          link={{ href: "/buyer/plan", label: "Plan an event" }}
        >
          <MenuFragment />
        </Showcase>
        <Showcase id="lp-person" band="blue" title="A person decides what matters" line="Over your limit, or a new product? It waits for one tap on your phone.">
          <PhoneFragment />
        </Showcase>
        <Showcase
          id="lp-valio"
          band="plain"
          flip
          title="Valio Aimo sees every agent"
          line="Every request, every order, and each sale it could not make."
          link={{ href: "/valio", label: "Open Valio Aimo’s side" }}
        >
          <DemandFragment />
        </Showcase>
        <Showcase
          id="lp-safe"
          band="petrol"
          title="Safe by design"
          line="We let an agent try to cheat, five ways. Each try was stopped."
          link={{ href: "/security", label: "See the security page" }}
        >
          <SafeFragment />
        </Showcase>
        <Showcase
          id="lp-shop"
          band="blue"
          flip
          title="Shop yourself or connect your agent"
          line="The same products and prices, for people and for agents. One line connects yours."
          link={{ href: "/connect", label: "Connect your own agent" }}
        >
          <ShopFragment />
          <OneLineCommand buyerId={PRIMARY_BUYER_ID} />
        </Showcase>
        <Criteria />
      </main>
      <LandingFooter />
      <Toaster />
      <Tour />
    </div>
  );
}
