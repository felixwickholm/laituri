import type { Metadata, Viewport } from "next";
import { PhoneBasket } from "@/components/approve-phone/PhoneBasket";
import "@/components/approve-phone/approve-phone.css";

export const metadata: Metadata = {
  title: "Lines that need you",
  description: "The lines of a basket that wait for the purchasing manager, one card each.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** The purchasing manager's phone over one basket. `?embed=1` is the walkthrough's phone frame. */
export default async function ApproveBasketPage({ params, searchParams }: PageProps<"/approve/basket/[id]">) {
  const [{ id }, { embed }] = await Promise.all([params, searchParams]);
  return <PhoneBasket basketId={id} embedded={embed === "1"} />;
}
