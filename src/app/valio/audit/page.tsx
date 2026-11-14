import type { Metadata } from "next";
import { AuditScreen } from "@/components/valio/AuditScreen";

export const metadata: Metadata = { title: "The record" };

export default function ValioAuditPage() {
  return <AuditScreen />;
}
