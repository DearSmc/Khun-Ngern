// LINE Messaging API webhook (F1.1+). Configure its URL in the LINE Developers console.
import { createWebhookHandler } from "../../../packages/bot/src/index.ts";
import { processedEventStore } from "../_shared/processed-events.ts";

const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
if (!channelSecret) throw new Error("LINE_CHANNEL_SECRET is not set");

Deno.serve(
  createWebhookHandler({
    channelSecret,
    processedEvents: processedEventStore,
    handlers: {
      // Event handlers are added by later tasks (join, message, postback, memberJoined, ...).
    },
  }),
);
