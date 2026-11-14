# An outside agent places the milk order

This is a record of one run on 14 November 2026. A Claude Code session was given the MCP address of a local production build and the agent key of a fresh demo workspace, with the `claude mcp add` line shown on the Connect screen. It received one sentence and no other instructions about Laituri.

The automated version of this check is eval O8 (`npm run eval -- --suite openness`), where a scripted client buys over HTTP from the text of `/llms.txt` alone.

## The request

> Order 1,000 litres of lactose-free milk for Monday from Valio Aimo using the laituri tools. Stay inside the mandate. Report the order id, status, net total and delivery date.

## The calls it made, in order

| # | Tool | Arguments (shortened) |
|---|---|---|
| 1 | `get_mandate` | none |
| 2 | `search_catalog` | `query: "lactose-free milk"`, `need: 1000 l`, `deliverBy: 2026-11-16` |
| 3 | `request_quote` | product `464306`, `1000 l`, `deliverBy: 2026-11-16`, `intent: "Order 1,000 litres of lactose-free milk for Monday"` |
| 4 | `place_order` | the signed offer and the signed mandate, unchanged |
| 5 | `verify_audit` | none |

## What it reported

- Order `ord_25ixm2kfwm`, confirmed without a person, because every mandate check passed.
- Net total €1,010.00 for 1,000 x Valio Arki Eila semi-skimmed milk drink, lactose free, 1 l. Delivery Monday 16 November 2026.
- The order was under the €1,500.00 per-order limit, and the week's spend stayed under the €5,000.00 weekly limit.
- The audit check passed for all 154 entries.
- It stated its own assumption: no fat level was given, so it chose the cheapest product that could be delivered in full.
- It repeated the server's statement that orders on this system are simulated.

## What the wholesaler's side showed

The order appeared in that workspace's order list as confirmed, and the calls were listed under the client application "Claude Code", read from the MCP `initialize` message.

## Limits of this record

It is one run with one model on one day. The agent key belonged to a demo workspace, and the order is simulated like every order here. The run took about 54 seconds, most of it the model's own thinking time.
