import type { Metadata } from "next";
import { TodayScreen } from "@/components/buyer/TodayScreen";

export const metadata: Metadata = { title: "Today" };

/** `?basket=<id>` leads with that basket, for a screen that just started one (the menu planner). */
export default async function TodayPage({ searchParams }: PageProps<"/buyer">) {
  const { basket } = await searchParams;
  return <TodayScreen basketId={typeof basket === "string" ? basket : undefined} />;
}
