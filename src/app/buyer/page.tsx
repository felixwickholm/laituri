import type { Metadata } from "next";
import { TodayScreen } from "@/components/buyer/TodayScreen";

export const metadata: Metadata = { title: "Today", description: "The kitchen's Today in Laituri: ask the purchasing agent in plain words, run the weekly order line by line, and see what needs a person." };

/** `?basket=<id>` leads with that basket, for a screen that just started one (the menu planner). */
export default async function TodayPage({ searchParams }: PageProps<"/buyer">) {
  const { basket } = await searchParams;
  return <TodayScreen basketId={typeof basket === "string" ? basket : undefined} />;
}
