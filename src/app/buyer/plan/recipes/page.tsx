import type { Metadata } from "next";
import { RecipeLibrary } from "@/components/menu/RecipeLibrary";

export const metadata: Metadata = { title: "Recipes", description: "The recipe library behind event menus: Valio professional recipes with ingredients, roles and allergens." };

export default function RecipesPage() {
  return <RecipeLibrary />;
}
