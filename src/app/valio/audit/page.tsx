import type { Metadata } from "next";
import { AuditScreen } from "@/components/valio/AuditScreen";

export const metadata: Metadata = { title: "The record", description: "The signed, hash-chained audit log of every agent decision, verifiable by anyone with the public keys." };

export default function ValioAuditPage() {
  return <AuditScreen />;
}
