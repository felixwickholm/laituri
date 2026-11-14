import type { Metadata, Viewport } from "next";
import { PhoneApproval } from "@/components/approve-phone/PhoneApproval";
import "@/components/approve-phone/approve-phone.css";

export const metadata: Metadata = {
  title: "An order that needs you",
  description: "An order your agent placed is past a limit and waits for the purchasing manager.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** The approver's phone view of one waiting order. `?embed=1` is the walkthrough's phone frame. */
export default async function ApprovePage({ params, searchParams }: PageProps<"/approve/[orderId]">) {
  const [{ orderId }, { embed }] = await Promise.all([params, searchParams]);
  return <PhoneApproval orderId={orderId} embedded={embed === "1"} />;
}
