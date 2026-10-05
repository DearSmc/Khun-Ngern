import type { ProcessedEventStore } from "../../../packages/bot/src/index.ts";
import { db } from "./db.ts";

/** Stores webhook event IDs in processed_webhook_events; the primary key rejects repeats. */
export const processedEventStore: ProcessedEventStore = {
  async markProcessed(webhookEventId) {
    const { data, error } = await db()
      .from("processed_webhook_events")
      .upsert({ webhook_event_id: webhookEventId }, { ignoreDuplicates: true })
      .select("webhook_event_id");
    if (error) throw error;
    // With ignoreDuplicates, an existing ID returns no row.
    return data.length === 1;
  },
};
