import type { Metadata } from "next";
import { BasketScreen } from "@/components/buyer/BasketScreen";

export const metadata: Metadata = { title: "Basket", description: "A weekly or menu basket: one signed offer and order per line, green, orange or red with the reason." };

/** One basket with every line; a line with an order opens the order sheet. */
export default async function BasketPage({ params }: PageProps<"/buyer/basket/[id]">) {
  const { id } = await params;
  return <BasketScreen basketId={id} />;
}
