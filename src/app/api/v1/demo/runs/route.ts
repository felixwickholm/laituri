import { z } from "zod";
import { startRun } from "@/lib/demo";
import { refuseAgents } from "@/lib/http/agent";
import { readBody, route } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const StartRunBody = z
  .object({
    scenario: z.enum(["milk", "over-limit", "break-mandate", "two-kitchens", "weekly"]).optional(),
    request: z.string().trim().min(1).max(300).optional(),
  })
  .refine((body) => (body.scenario === undefined) !== (body.request === undefined), {
    message: "Give either a scenario or a request, not both.",
  });

export const POST = route(async (request) => {
  refuseAgents(request.headers);
  const body = await readBody(request, StartRunBody);
  const { runId } = startRun(body, { baseUrl: new URL(request.url).origin });
  return json({ runId }, { status: 202, headers: { location: `/api/v1/demo/runs/${runId}` } });
});
