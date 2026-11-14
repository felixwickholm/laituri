"use client";

import type { SyntheticEvent } from "react";
import { basketStore } from "@/lib/console/basket-store";

/** When the page behind asks for the basket again after a tap on the phone: soon, and once more for a slow answer. */
const AFTER_TAP_MS = [600, 1_500, 3_000];

/** A tap on the phone changes the basket on the server; the page behind reads it again so the card can say so. */
function followTaps(event: SyntheticEvent<HTMLIFrameElement>) {
  event.currentTarget.contentDocument?.addEventListener("click", () => {
    for (const ms of AFTER_TAP_MS) setTimeout(() => void basketStore.tick(), ms);
  });
}

/** The purchasing manager's phone: a plain device frame around the real page for the basket's waiting lines. */
export function PhoneStage({ basketId }: { basketId: string }) {
  return (
    <div className="tour-phone" data-tour-phone>
      <div className="tour-phone-notch" aria-hidden="true" />
      <iframe
        className="tour-phone-screen"
        src={`/approve/basket/${encodeURIComponent(basketId)}?embed=1`}
        title="The purchasing manager’s phone: the lines that need a person"
        onLoad={followTaps}
      />
    </div>
  );
}
