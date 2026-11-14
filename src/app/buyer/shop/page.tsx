import type { Metadata } from "next";
import { ShopScreen } from "@/components/shop/ShopScreen";
import { serverOrigin } from "@/lib/connect/origin";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";

export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage() {
  return <ShopScreen serverOrigin={await serverOrigin()} buyerId={PRIMARY_BUYER_ID} />;
}
