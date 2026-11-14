export type Access = "open" | "agent key" | "a person, never an agent";

export interface ToolCopy {
  does: string;
  needs: Access;
}

/**
 * Plain words for each MCP tool. A test checks that every tool the server lists has them. The table shows only the
 * tools the server lists, so a tool that is not live yet never appears.
 */
export const TOOL_COPY: Record<string, ToolCopy> = {
  search_catalog: { does: "Finds products for a need in plain words. Live price, stock and pack maths.", needs: "open" },
  get_product: { does: "Reads one product: packs, content, allergens, labels and substitutes.", needs: "open" },
  request_quote: { does: "Gets a fixed price for a delivery day. Valio Aimo signs it. It holds 15 minutes.", needs: "open" },
  get_mandate: { does: "Reads the limits the buyer set for this agent.", needs: "open" },
  place_order: { does: "Orders a fixed price. Inside the limits it is confirmed. Above them, a person decides.", needs: "agent key" },
  place_basket: { does: "Orders many lines at once. Each line is checked against the limits.", needs: "agent key" },
  get_order: { does: "Reads an order's status and its signed receipt.", needs: "open" },
  plan_menu: { does: "Turns an event into three menus with a shopping list.", needs: "open" },
  list_recipes: { does: "Lists the recipes the menu planner uses.", needs: "open" },
  plan_event: { does: "Talks an event through, one message at a time, to a menu and an order.", needs: "open" },
  verify_audit: { does: "Checks every signature and link in the record. Returns a signed checkpoint.", needs: "open" },
};

/** Not a tool: shown as the last row so the boundary is visible. */
export const APPROVAL_ROW = { name: "approve or reject", does: "Decides an order above the limits.", needs: "a person, never an agent" as Access };

export const NEVER = "An agent can never raise its own limit, change a price or approve its own order.";
