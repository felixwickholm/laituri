import type { Metadata } from "next";
import { OrdersScreen } from "@/components/buyer/OrdersScreen";

export const metadata: Metadata = { title: "Orders", description: "Orders placed by the customer's agent: confirmed, waiting for a person or blocked, each with its signed offer and reasons." };

export default function OrdersPage() {
  return <OrdersScreen />;
}
