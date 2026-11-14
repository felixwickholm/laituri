import { z } from "zod";
import { IsoDateTime } from "./common";

export const CreateHandoffRequest = z.object({
  basketId: z.string().min(1).optional(),
  lineId: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  words: z.string().trim().min(1).max(1000).describe("What the kitchen wants a person at Valio Aimo to know"),
});
export type CreateHandoffRequest = z.infer<typeof CreateHandoffRequest>;

export const HandoffAnswerRequest = z.object({
  words: z.string().trim().min(1).max(1000),
});
export type HandoffAnswerRequest = z.infer<typeof HandoffAnswerRequest>;

export const OpenHours = z.object({
  open: z.boolean().describe("Whether a person at Valio Aimo answers now (demo assumption: Monday to Friday 8:00-16:00 Helsinki time)"),
  sentence: z.string().describe("For example 'Valio Aimo answers on Monday from 8:00. Your order is safe until then.'"),
});
export type OpenHours = z.infer<typeof OpenHours>;

/** A kitchen asks a person at Valio Aimo; an operator answers. */
export const Handoff = z.object({
  id: z.string(),
  at: IsoDateTime,
  buyer: z.object({ id: z.string(), name: z.string() }),
  from: z.string().describe("The person who asked"),
  words: z.string(),
  context: z.object({
    basketId: z.string().optional(),
    lineId: z.string().optional(),
    orderId: z.string().optional(),
    summary: z.string().describe("What the question is about, in one plain sentence"),
  }),
  status: z.enum(["open", "answered"]),
  openHours: OpenHours,
  answer: z.object({ at: IsoDateTime, by: z.string(), words: z.string() }).optional(),
});
export type Handoff = z.infer<typeof Handoff>;

export const HandoffList = z.object({ handoffs: z.array(Handoff) });
