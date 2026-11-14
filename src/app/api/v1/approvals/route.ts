import { gateway } from "@/lib/gateway";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async () => json({ orders: await gateway().pendingApprovals() }));
