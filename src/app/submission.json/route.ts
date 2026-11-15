import { publicJson } from "@/lib/discovery/respond";
import { submission } from "@/lib/discovery/submission";
import { route } from "@/lib/http/handler";
import { originOf } from "@/lib/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The Junction submission in one machine-readable document: problem, solution, views, agent, controls, evidence, links, limits. */
export const GET = route(async (request) => publicJson(submission(originOf(request))));
