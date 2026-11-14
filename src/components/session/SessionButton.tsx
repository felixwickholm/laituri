"use client";

import { LogOut, UserRound } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { shortName } from "@/lib/console/format/rules";
import { consoleStore } from "@/lib/console/store";
import type { ConsoleSession } from "@/lib/console/types";
import { toast } from "../ui/toast";
import { useDismiss } from "../ui/useDismiss";
import { requestSignIn } from "./gate";

/** Who signs approvals in this browser, or a way to sign in as the approver. */
export function SessionButton({ session }: { session?: ConsoleSession }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  if (!session?.signedIn) {
    return (
      <button
        type="button"
        className="btn session-btn"
        onClick={async (event) => {
          if (await requestSignIn(event.currentTarget)) toast("Signed in as approver.");
        }}
        aria-label="Sign in as approver"
      >
        <UserRound aria-hidden="true" />
        <span className="label">Sign in as approver</span>
      </button>
    );
  }

  const name = shortName(session.approver?.name ?? "Approver");
  return (
    <div ref={root} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn session-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${name}`}
        onClick={() => setOpen(!open)}
      >
        <UserRound aria-hidden="true" />
        <span className="label">{name}</span>
      </button>
      {open ? (
        <div className="menu glass" role="menu" style={{ top: 44, right: 0 }}>
          <p className="hint">Your approvals are signed with the approver key.</p>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              close();
              await consoleStore.signOut().catch(() => undefined);
              toast("Signed out.", "neutral");
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
