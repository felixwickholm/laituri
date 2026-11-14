# 7. A scripted agent as the deterministic default; model-driven agents behind an adapter

- Status: accepted
- Code: [`src/lib/agent/purchase.ts`](../../src/lib/agent/purchase.ts), [`src/lib/agent/llm`](../../src/lib/agent/llm), [`src/lib/demo/scenarios.ts`](../../src/lib/demo/scenarios.ts)

## Context and problem statement

Laituri is the wholesaler's front door, not the buyer's agent. The demo still needs a buyer agent, and the evals need results that repeat. A language model gives a more realistic agent, but its answers vary and it needs a paid key.

## Considered options

1. A model-driven agent everywhere.
2. A scripted agent only.
3. A scripted agent for fixed scenes, tests and evals; Claude or Gemini for free-text requests when a key is set, behind one provider interface.

## Decision outcome

Option 3. The scripted agent parses the request, searches, quotes, reads the mandate and orders with the same calls an outside agent makes (in process or over HTTP). The model-driven agent gets the same tools and runs a tool-use loop; `LAITURI_AGENT_ENGINE` is `auto` (Claude, else Gemini, else scripted), `claude`, `gemini` or `scripted`. Provider keys stay on the server and are never shown to the model.

## Consequences

- Good: tests and evals are deterministic and need no paid service.
- Good: the gateway's guarantees do not depend on which agent calls; an outside agent gets the same checks (eval O8).
- Bad: the default demo scenes do not show a model's reasoning; free text does when a key is set.

## Confirmation

[`tests/agent/llm-engine.test.ts`](../../tests/agent/llm-engine.test.ts), [`tests/agent/llm-loop.test.ts`](../../tests/agent/llm-loop.test.ts), [`tests/agent/purchase.test.ts`](../../tests/agent/purchase.test.ts).
