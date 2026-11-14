"use client";

import { createPortal } from "react-dom";
import { STEPS } from "@/lib/tour/steps";
import { ResumePill } from "./ResumePill";
import { TourLayer } from "./TourLayer";
import { tourStore, useTour } from "./tour-store";
import { useTourRunner } from "./useTourRunner";

/**
 * The guided walkthrough, mounted once per page frame. It carries the story across pages, and after
 * Escape it waits as a small pill that resumes where it stopped.
 */
export function Tour() {
  const state = useTour();
  useTourRunner(state);

  if (state.status === "closed") return null;
  if (state.status === "paused") {
    return (
      <ResumePill
        step={state.index + 1}
        total={STEPS.length}
        onResume={() => tourStore.dispatch({ type: "resume" })}
        onDismiss={() => tourStore.dispatch({ type: "close" })}
      />
    );
  }
  return createPortal(<TourLayer state={state} />, document.body);
}
