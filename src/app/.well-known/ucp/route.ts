import { ucpProfile } from "@/lib/discovery/documents";
import { publicJson } from "@/lib/discovery/respond";
import { originOf } from "@/lib/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (request: Request) => publicJson(await ucpProfile(originOf(request)));
