import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { beforeEach, describe, expect, it } from "vitest";
import * as turn from "@/app/api/v1/assistant/turn/route";
import * as baskets from "@/app/api/v1/baskets/route";
import { AssistantTurn } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";

const harbour = { authorization: `Bearer ${AGENT_TOKEN}` };
const post = (body: unknown, headers: Record<string, string> = harbour) => turn.POST(jsonRequest("/api/v1/assistant/turn", { body, headers }));

beforeEach(async () => {
  await gateway().reset();
});

describe("POST /api/v1/assistant/turn", () => {
  it("runs a conversation to a basket", async () => {
    const first = AssistantTurn.parse(await (await post({ words: "Meillä on häät lauantaina, 80 vierasta, kaksi keliaakikkoa" })).json());
    expect(first.engine).toBe("rules");
    expect(first.cards.filter((card) => card.kind === "menu")).toHaveLength(3);
    const order = AssistantTurn.parse(await (await post({ conversationId: first.conversationId, words: "Tilaa se" })).json());
    const action = order.actions.find((entry) => entry.kind === "order_menu" && entry.now);
    if (action?.kind !== "order_menu") throw new Error("no order action");
    const started = await baskets.POST(jsonRequest("/api/v1/baskets", { body: action.basket, headers: harbour }));
    expect(started.status).toBe(202);
    expect(((await started.json()) as { basketId: string }).basketId).toBeTruthy();
  });

  it("answers 401 without a credential and 400 for empty words", async () => {
    expect((await post({ words: "hello" }, {})).status).toBe(401);
    expect((await post({ words: "" })).status).toBe(400);
  });
});
