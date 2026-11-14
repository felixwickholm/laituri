import type { Metadata } from "next";
import { RecipeLibrary } from "@/components/menu/RecipeLibrary";

export const metadata: Metadata = { title: "Recipes" };

export default function RecipesPage() {
  return <RecipeLibrary />;
}
