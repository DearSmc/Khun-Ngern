// LINE Messaging API webhook (F1.1+). Configure its URL in the LINE Developers console.
import { createWebhookHandler } from "../../../packages/bot/src/index.ts";

const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
if (!channelSecret) throw new Error("LINE_CHANNEL_SECRET is not set");

Deno.serve(
  createWebhookHandler({
    channelSecret,
    handlers: {
      // Event handlers are added by later tasks (join, message, postback, memberJoined, ...).
    },
  }),
);
