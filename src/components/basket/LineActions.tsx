"use client";

import { Ellipsis, MessageCircle } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { moreOptions, primaryOption } from "@/lib/console/basket";
import type { BasketLine, LineOption } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { useDismiss } from "../ui/useDismiss";
import type { Resolver } from "./useResolve";

/** The other choices and the hand-off, behind one "More" button. */
function MoreMenu({ line, options, resolver }: { line: BasketLine; options: LineOption[]; resolver: Resolver }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const busy = resolver.busy === line.id;

  return (
    <div className="more-menu" ref={ref}>
      <button type="button" className="btn btn-secondary" aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={busy} onClick={() => setOpen(!open)}>
        <Ellipsis aria-hidden="true" />
        More
      </button>
      {open ? (
        <div className="more-menu-list" role="menu" id={id}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className="more-menu-item"
              onClick={(event) => {
                setOpen(false);
                void resolver.choose(line, option, event.currentTarget.closest(".more-menu"));
              }}
            >
              <span>{option.label}</span>
              {option.detail || option.net !== undefined ? (
                <span className="more-menu-detail">{[option.detail, option.net !== undefined ? `${eur(option.net)} net` : undefined].filter(Boolean).join(" · ")}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="more-menu-item"
            onClick={() => {
              setOpen(false);
              resolver.ask(line);
            }}
          >
            <span className="more-menu-ask">
              <MessageCircle aria-hidden="true" />
              Ask Valio Aimo
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** For an orange or red line: the first option as the primary button, the rest and "Ask Valio Aimo" behind "More". */
export function LineActions({ line, resolver }: { line: BasketLine; resolver: Resolver }) {
  const primary = primaryOption(line);
  const busy = resolver.busy === line.id;
  return (
    <div className="line-actions">
      {primary ? (
        <button
          type="button"
          className={line.state === "orange" ? "btn btn-primary" : "btn btn-secondary"}
          data-tour={line.state === "orange" ? "resolve" : undefined}
          disabled={busy}
          onClick={(event) => void resolver.choose(line, primary, event.currentTarget)}
        >
          {busy ? "Saving…" : primary.label}
        </button>
      ) : null}
      {primary ? (
        <MoreMenu line={line} options={moreOptions(line)} resolver={resolver} />
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => resolver.ask(line)}>
          <MessageCircle aria-hidden="true" />
          Ask Valio Aimo
        </button>
      )}
    </div>
  );
}
