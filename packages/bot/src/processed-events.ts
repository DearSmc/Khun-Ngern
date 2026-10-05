// Idempotency (PRD §6): LINE may deliver the same webhook event more than once.

export interface ProcessedEventStore {
  /** Records the event ID. Returns true the first time, false if it was already recorded. */
  markProcessed(webhookEventId: string): Promise<boolean>;
}

/** In-memory store for tests and local runs. Not shared between server instances. */
export function createMemoryEventStore(): ProcessedEventStore {
  const seen = new Set<string>();
  return {
    markProcessed(id) {
      if (seen.has(id)) return Promise.resolve(false);
      seen.add(id);
      return Promise.resolve(true);
    },
  };
}
