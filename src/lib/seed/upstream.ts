import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "@/lib/valio/types";

/**
 * The recorded wholesaler answers, moved to the seeded day. Prices and stock are replayed as recorded;
 * the delivery date and order cut-off of every deliverable product follow the slot set for the current request,
 * the way the recording's own dates relate to the day it was made.
 */
export class SeedUpstream implements UpstreamClient {
  private slot?: { deliverBy: string; orderBy: Date };

  constructor(private readonly recorded: UpstreamClient) {}

  /** The delivery date and cut-off the next answers report. */
  setSlot(slot: { deliverBy: string; orderBy: Date }): void {
    this.slot = slot;
  }

  price(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamPrice>> {
    return this.recorded.price(productIds, date, customer);
  }

  async availability(productIds: string[], date: string, customer: string): Promise<Map<string, UpstreamAvailability>> {
    const answers = await this.recorded.availability(productIds, date, customer);
    const slot = this.slot;
    if (!slot) return answers;
    const moved = [...answers].map(([id, answer]): [string, UpstreamAvailability] => [
      id,
      answer.availableDate ? { ...answer, availableDate: slot.deliverBy, orderBy: slot.orderBy.toISOString() } : answer,
    ]);
    return new Map(moved);
  }
}
