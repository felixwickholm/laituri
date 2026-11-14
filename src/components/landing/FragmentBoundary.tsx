"use client";

import { Component, type ReactNode } from "react";

/** Keeps the page standing if a live fragment fails to draw: it shows the fallback crop instead. */
export class FragmentBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
