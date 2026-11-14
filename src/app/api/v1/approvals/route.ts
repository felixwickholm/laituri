import { gateway } from "@/lib/gateway";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = route(async (request) => json({ orders: await gateway().pendingApprovals(await readerBuyer(request)) }));
