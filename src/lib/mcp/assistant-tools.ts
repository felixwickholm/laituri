import { AssistantTurnRequest, type AssistantTurn } from "@/lib/contracts";
import { assistantTurnFor } from "@/lib/assistant/service";
import type { AgentRef } from "@/lib/gateway";
import { CredentialRequiredError } from "@/lib/http/reader";
import { eur } from "@/lib/offers/format";
import type { ToolDefinition } from "./tools";

function turnText(turn: AssistantTurn): string {
  const menus = turn.cards.flatMap((card) =>
    card.kind === "menu" ? [`${card.label}${card.recommended ? " (suggested)" : ""}: ${card.name}, ${eur(card.costPerGuest)} per guest (${card.id})`] : [],
  );
  const recipes = turn.cards.flatMap((card) => (card.kind === "recipe" ? [`Recipe: ${card.name} (${card.id})`] : []));
  const asks = turn.asks?.length ? [`Still needed: ${turn.asks.join(", ")}`] : [];
  return [turn.reply, ...asks, ...menus, ...recipes, `conversationId: ${turn.conversationId}`].join("\n");
}

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: "plan_event",
    title: "Talk an event through to a menu and an order",
    description:
      "Use for a conversation about an event, one message at a time (\"We have a wedding for 80 on Saturday, two coeliacs\", Finnish too). " +
      "Pass the conversationId from the previous answer to continue. Returns a short reply in the kitchen's language, what is still needed (asks), " +
      "cards (menus with price per guest from the planner, recipes, the shopping list) and actions. An order_menu action carries a ready basket request: " +
      "post it to POST /api/v1/baskets or call place_basket with its lines. Facts come from the planner, never from a model.",
    operationId: "assistantTurn",
    input: AssistantTurnRequest,
    output: "AssistantTurn",
    run: (agent: AgentRef, input: AssistantTurnRequest) => {
      if (!agent.buyer) throw new CredentialRequiredError("the event assistant");
      return assistantTurnFor(agent.buyer.id, AssistantTurnRequest.parse(input));
    },
    summarize: turnText,
  } as unknown as ToolDefinition,
];
