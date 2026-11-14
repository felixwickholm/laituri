export type Access = "open" | "agent key" | "a person, never an agent";

export interface ToolCopy {
  does: string;
  needs: Access;
}

/** Plain words for each MCP tool. A test keeps the keys equal to the server's tool list. */
export const TOOL_COPY: Record<string, ToolCopy> = {
  search_catalog: { does: "Turns a need in plain words into products, with live price, stock and pack maths.", needs: "open" },
  get_product: { does: "Reads one product: units, content, allergens, claims and substitutes.", needs: "open" },
  request_quote: { does: "Gets a fixed price for a delivery date, signed by Valio Aimo and valid for 15 minutes.", needs: "open" },
  get_mandate: { does: "Reads the limits the buyer signed for this agent.", needs: "open" },
  place_order: { does: "Orders a signed offer. Inside the mandate it is confirmed; above it, a person decides.", needs: "agent key" },
  get_order: { does: "Checks an order's status and its signed receipt.", needs: "open" },
  verify_audit: { does: "Checks every signature and link in the audit log and returns a signed checkpoint.", needs: "open" },
};

/** Not a tool: shown as the last row so the boundary is visible. */
export const APPROVAL_ROW = { name: "approve or reject", does: "Decides an order above the mandate's limit.", needs: "a person, never an agent" as Access };

export const NEVER = "An agent can never raise its own limit, change a price or approve its own order.";
