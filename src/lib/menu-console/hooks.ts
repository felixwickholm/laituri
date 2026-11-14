"use client";

import { useEffect, useState } from "react";
import { isLocked, isMissing, menuApi } from "./api";
import { courseIndex } from "./format";
import type { MenuOption } from "./types";

export interface Loaded<T> {
  data?: T;
  /** The plain sentence of the last failure. */
  error?: string;
  /** The route is not there yet: a screen stays quiet. */
  missing?: boolean;
  /** The server wants a sign-in first. */
  locked?: boolean;
}

function failure(error: unknown): Loaded<never> {
  if (isMissing(error)) return { missing: true };
  if (isLocked(error)) return { locked: true };
  return { error: error instanceof Error ? error.message : "That did not load." };
}

/** Loads once on mount, and again whenever `key` changes. */
export function useLoaded<T>(load: () => Promise<T>, key = ""): Loaded<T> & { loading: boolean } {
  const [state, setState] = useState<{ key: string; value: Loaded<T> } | undefined>();
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, value: { data } }),
      (error: unknown) => live && setState({ key, value: failure(error) }),
    );
    return () => {
      live = false;
    };
    // `load` is a fresh arrow on every render; `key` is what names the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!state || state.key !== key) return { loading: true };
  return { ...state.value, loading: false };
}

export const useSuggestions = () => useLoaded(menuApi.suggestions, "suggestions");
export const useRecipes = () => useLoaded(menuApi.recipes, "recipes");
export const useRecipe = (id: string) => useLoaded(() => menuApi.recipe(id), id);

/** Which course each shopping line belongs to, from the menu's own recipes. Empty until they load. */
export function useCourseIndex(option: MenuOption) {
  const ids = option.courses.map((course) => course.recipe.id);
  const loaded = useLoaded(async () => courseIndex(await Promise.all(ids.map(menuApi.recipe))), ids.join(","));
  return loaded.data;
}
