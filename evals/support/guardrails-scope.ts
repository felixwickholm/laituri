import { quoteLitres } from "./flow";
import { guardrail } from "./hostile";
import { AGENT_AUTH, get } from "./router";

const KAISLA_AUTH = { authorization: "Bearer demo-kaisla-token" };

export const SCOPE_GUARDRAILS = [
  guardrail("G21", "Another buyer's offer by id", "404 for another buyer's token, as for a missing offer; 200 for the own buyer's token", async (hostile, checks) => {
    const { primary } = await quoteLitres(10);
    const path = `/api/v1/offers/${primary.offer.id}`;
    const other = await hostile.try("other buyer reads the offer", () => get(path, KAISLA_AUTH));
    const missing = await hostile.try("other buyer reads a missing offer", () => get("/api/v1/offers/off_never_issued", KAISLA_AUTH));
    const own = await get(path, AGENT_AUTH);
    const code = (reply: typeof other) => (reply.body as { code?: string } | undefined)?.code;
    checks.expect(other.status === 404, `another buyer's token read the offer with ${other.status}`);
    checks.expect(code(other) === code(missing), `another buyer's offer answered ${code(other)}, a missing one ${code(missing)}`);
    checks.expect(own.status === 200, `the own buyer's token read its offer with ${own.status}`);
    return `other buyer ${other.status} ${code(other) ?? ""}; missing ${missing.status}; own buyer ${own.status}`;
  }),
];
