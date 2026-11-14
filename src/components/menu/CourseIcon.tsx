import { CakeSlice, CupSoda, Salad, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Course } from "@/lib/menu-console/types";

const ICON: Record<Course, LucideIcon> = {
  starter: Soup,
  main: UtensilsCrossed,
  side: Salad,
  dessert: CakeSlice,
  drink: CupSoda,
};

/** One line icon per course, the same weight everywhere. */
export function CourseIcon({ course, size = 18 }: { course: Course; size?: number }) {
  const Icon = ICON[course] ?? UtensilsCrossed;
  return <Icon className="course-icon" size={size} strokeWidth={1.5} aria-hidden />;
}
