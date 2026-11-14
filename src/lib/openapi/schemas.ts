import { z } from "zod";
import {
  ApprovalDecisionRequest,
  Basket,
  BasketList,
  BasketStarted,
  CreateBasketRequest,
  CreateHandoffRequest,
  Handoff,
  HandoffAnswerRequest,
  HandoffList,
  ResolveLineRequest,
  WeeklyDraft,
  AuditEntry,
  AuditVerification,
  Mandate,
  MenuPlan,
  MenuPlanRequest,
  Money,
  Order,
  PantryList,
  PlaceOrderRequest,
  Product,
  QuoteRequest,
  QuoteResponse,
  Recipe,
  RecipeList,
  SearchRequest,
  SearchResponse,
  SignedOffer,
  SuggestionList,
  SupplierOverview,
  SuspensionRequest,
  SuspensionState,
  WorkspaceInfo,
  WorkspaceViewRequest,
  AssistantTurnRequest,
  AssistantTurn,
} from "@/lib/contracts";
import { MAX_SPEECH_CHARS } from "@/lib/voice/server";

/** Schemas the front door adds around the frozen contracts (wrappers, health, problems). */

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().describe("What went wrong, in one plain sentence"),
  code: z.string().describe("Stable machine-readable error code"),
  violations: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const BlockedOrderProblem = ProblemSchema.extend({
  order: Order.describe("The blocked order as recorded: its decision lists every rule that was checked and the ones that blocked it"),
});

export const SignedMandate = z.object({
  jws: z.string().describe("Buyer-signed mandate JWT. Pass it unchanged as mandateJws when placing an order."),
  mandate: Mandate,
});

const mandateShape = Mandate.omit({ id: true, version: true }).shape;
/** Every top-level field is optional; nested objects merge one level deep. */
export const MandatePatchBody = z
  .object(
    Object.fromEntries(
      Object.entries(mandateShape).map(([key, schema]) => [
        key,
        (schema instanceof z.ZodObject ? schema.partial() : schema).optional(),
      ]),
    ),
  )
  .strict();

export const PlaceOrderBody = PlaceOrderRequest.extend({
  idempotencyKey: PlaceOrderRequest.shape.idempotencyKey
    .optional()
    .describe("Repeat the same key to retry safely. May be sent as the Idempotency-Key header instead."),
});

export const OrderList = z.object({ orders: z.array(Order) });

export const AuditLog = z.object({ entries: z.array(AuditEntry) });

export const Checkpoint = z.object({
  checkpoint: z.object({
    size: z.number().int().describe("Number of entries in the log"),
    head: z.string().describe("Hash of the newest entry"),
    at: z.string(),
  }),
  jws: z.string().describe("Wholesaler signature over the checkpoint"),
});

export const AuditProof = z.object({
  verification: AuditVerification,
  checkpoint: Checkpoint,
});

export const ActivityItem = z.object({
  id: z.string(),
  at: z.string(),
  agent: z.object({ id: z.string(), name: z.string() }),
  buyer: z.object({ id: z.string(), name: z.string() }).optional().describe("The buyer whose token the agent holds"),
  client: z.string().optional().describe("The client application that made the call, for example Claude Code or curl"),
  kind: z.enum(["tool", "note"]),
  tool: z.string().optional(),
  title: z.string(),
  detail: z.string().optional(),
  status: z.enum(["ok", "waiting", "blocked", "error"]),
  refs: z.object({ offerId: z.string().optional(), orderId: z.string().optional() }).optional(),
  durationMs: z.number().optional(),
  seeded: z.literal(true).optional().describe("Demo history written at start-up"),
});

export const ActivityList = z.object({ activity: z.array(ActivityItem) });

export const Health = z.object({
  status: z.enum(["ok", "degraded"]),
  mode: z.enum(["live", "recorded"]).describe("live calls the wholesaler API; recorded replays saved responses"),
  upstream: z.object({
    ok: z.boolean(),
    latencyMs: z.number().optional(),
    error: z.string().optional(),
    calls: z.number().int().optional().describe("Requests the caller's workspace sent the price and availability APIs since start-up; cached answers are not counted"),
    productsAsked: z.number().int().optional().describe("Product ids those requests carried. Search runs on the local product files; only a few candidates per request are asked"),
    total: z.object({ calls: z.number().int(), productsAsked: z.number().int() }).optional().describe("The same across every workspace"),
    catalogueSize: z.number().int().optional().describe("Products in the local catalogue, for comparison"),
  }),
  catalog: z.object({ ready: z.boolean(), size: z.number().int() }),
  seed: z
    .object({
      state: z.enum(["seeded", "skipped", "failed", "off"])
        .describe("seeded: history was written; skipped: the state already held orders or audit entries; failed: writing it failed; off: LAITURI_SEED=off"),
      at: z.string().optional().describe("When the history was written; set when seeded"),
      requests: z.number().int().optional().describe("Buyer requests written; set when seeded"),
      orders: z.number().int().optional().describe("Orders among them; set when seeded"),
      reason: z.string().optional().describe("Why nothing was written; set when skipped or failed"),
    })
    .describe("Whether demo history was written at start-up (LAITURI_SEED)"),
  agent: z
    .object({
      engine: z.enum(["claude", "gemini", "scripted"]).describe("scripted needs no model key"),
      model: z.string().optional().describe("The model name; set for claude and gemini"),
    })
    .describe("Which engine runs free-text requests from the console (LAITURI_AGENT_ENGINE and the model keys)"),
  sandboxes: z
    .object({
      active: z.number().int().describe("Sandboxes used within the idle limit"),
      max: z.number().int().describe("At most this many live at once (LAITURI_SANDBOX_MAX); the least recently used is dropped first"),
      idleMinutes: z.number().int().describe("An unused sandbox is replaced by a fresh copy after this long (LAITURI_SANDBOX_IDLE_MINUTES)"),
      template: z
        .object({
          state: z.enum(["seeded", "skipped", "failed", "off"]).describe("seeded: the template holds the demo week; failed: writing it failed, sandboxes start empty; off: LAITURI_SEED=off"),
          at: z.string().optional(),
          requests: z.number().int().optional(),
          orders: z.number().int().optional(),
          reason: z.string().optional(),
        })
        .describe("The seeded workspace every sandbox starts as a copy of"),
    })
    .describe("Per-browser sandboxes: how many are active and what they are copied from"),
  store: z
    .object({
      recovery: z
        .object({ keptAs: z.string(), reason: z.string(), at: z.string() })
        .optional()
        .describe("Set when the saved state could not be read at start-up: the file was kept under keptAs and the service started empty"),
      lastSaveError: z.string().optional().describe("Set while the last delayed save of offers, activity or demand failed"),
    })
    .describe("The saved state on disk. Orders, approvals, mandate changes and audit entries are saved before their call returns"),
  time: z.string(),
});

export const VoiceSettings = z.object({
  tts: z.enum(["elevenlabs", "browser"]).describe("elevenlabs: POST /api/v1/voice/speech speaks; browser: use the browser's own voices"),
  stt: z.enum(["elevenlabs", "browser"]).optional().describe("elevenlabs: POST /api/v1/voice/transcribe hears; browser: the browser's own speech recognition"),
});

export const Transcript = z.object({ text: z.string().describe("The words heard; empty when nothing was said") });

export const SpeechRequest = z.object({ text: z.string().trim().min(1).max(MAX_SPEECH_CHARS).describe("The text to read aloud") });

export const SpeechAudio = z.string().describe("MP3 audio of the text");

export const ResetResult = z.object({ ok: z.literal(true), detail: z.string(), seed: Health.shape.seed.optional() });

/** Every named schema, keyed by its component name. Operations and tools refer to these names. */
export const SCHEMAS = {
  WorkspaceInfo,
  WorkspaceViewRequest,
  Money,
  Product,
  SearchRequest,
  SearchResponse,
  QuoteRequest,
  QuoteResponse,
  SignedOffer,
  PlaceOrderRequest,
  PlaceOrderBody,
  Order,
  OrderList,
  ApprovalDecisionRequest,
  Mandate,
  SignedMandate,
  MandatePatch: MandatePatchBody,
  AuditEntry,
  AuditLog,
  AuditVerification,
  Checkpoint,
  AuditProof,
  ActivityItem,
  ActivityList,
  Health,
  ResetResult,
  SupplierOverview,
  SuspensionRequest,
  SuspensionState,
  VoiceSettings,
  SpeechRequest,
  SpeechAudio,
  Problem: ProblemSchema,
  BlockedOrderProblem,
  MenuPlanRequest,
  MenuPlan,
  RecipeList,
  Recipe,
  PantryList,
  SuggestionList,
  CreateBasketRequest,
  BasketStarted,
  Basket,
  BasketList,
  ResolveLineRequest,
  WeeklyDraft,
  CreateHandoffRequest,
  HandoffAnswerRequest,
  Handoff,
  HandoffList,
  AssistantTurnRequest,
  AssistantTurn,
  Transcript,
} satisfies Record<string, z.ZodType>;

export type SchemaName = keyof typeof SCHEMAS;
