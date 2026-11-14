"use client";

import { useState } from "react";
import type { Tile } from "@/lib/connect/apps";
import { guideFor, type AppId } from "@/lib/connect/guides";
import { CodeBlock } from "./CodeBlock";

/** Numbered steps for the chosen app. Claude has a second switch: the terminal or the chat apps. Keyed by tile. */
export function SetupGuide({ tile, origin, agentKey, deliverBy }: { tile: Tile; origin: string; agentKey: string; deliverBy: string }) {
  const [app, setApp] = useState<AppId>(tile.guides[0].id);
  const guide = guideFor(app, origin, agentKey, deliverBy);

  return (
    <div className="cx-guide" id="cx-guide" role="tabpanel" aria-labelledby={`cx-tab-${tile.id}`}>
      {tile.guides.length > 1 && (
        <div className="cx-variant" role="group" aria-label={`${tile.name} app`}>
          {tile.guides.map((option) => (
            <button key={option.id} type="button" aria-pressed={option.id === app} onClick={() => setApp(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      )}
      <ol className="cx-steps">
        {guide.steps.map((step) => (
          <li key={step.text}>
            <p>{step.text}</p>
            {step.code && <CodeBlock code={step.code} />}
          </li>
        ))}
      </ol>
      {guide.localNote && <p className="cx-note">{guide.localNote}</p>}
      {guide.links && (
        <p className="cx-docs">
          Everything else is in{" "}
          {guide.links.map((link, index) => (
            <span key={link.href}>
              {index > 0 && " and "}
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
