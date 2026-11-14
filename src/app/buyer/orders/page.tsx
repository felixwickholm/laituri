import type { Metadata } from "next";
import { OrdersScreen } from "@/components/buyer/OrdersScreen";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrdersScreen />;
}
