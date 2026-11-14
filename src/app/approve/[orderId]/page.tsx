import type { Metadata, Viewport } from "next";
import { PhoneApproval } from "@/components/approve-phone/PhoneApproval";
import "@/components/approve-phone/approve-phone.css";

export const metadata: Metadata = {
  title: "Approve an order · Laituri",
  description: "An order your purchasing agent placed is over a limit and waits for your signed decision.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** The approver's phone view of one waiting order. `?embed=1` is the walkthrough's phone frame. */
export default async function ApprovePage({ params, searchParams }: PageProps<"/approve/[orderId]">) {
  const [{ orderId }, { embed }] = await Promise.all([params, searchParams]);
  return <PhoneApproval orderId={orderId} embedded={embed === "1"} />;
}
