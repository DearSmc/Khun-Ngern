// LINE webhook entry point: checks the signature, then hands each event to its handler.
import type { WebhookBody, WebhookEvent } from "./line-types.ts";
import type { ProcessedEventStore } from "./processed-events.ts";
import { verifyLineSignature } from "./signature.ts";

export type EventHandler = (event: WebhookEvent) => Promise<void>;

export interface WebhookOptions {
  channelSecret: string;
  /** Handlers by LINE event type ("message", "join", "postback", ...). Others are ignored. */
  handlers: Partial<Record<string, EventHandler>>;
  /** Skips events whose webhookEventId was already handled (redeliveries). */
  processedEvents: ProcessedEventStore;
  logError?: (message: string, error: unknown) => void;
}

export function createWebhookHandler(options: WebhookOptions): (req: Request) => Promise<Response> {
  const logError = options.logError ?? ((message, error) => console.error(message, error));

  return async (req) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const rawBody = await req.text();
    const valid = await verifyLineSignature(
      options.channelSecret,
      rawBody,
      req.headers.get("x-line-signature"),
    );
    if (!valid) return new Response("Unauthorized", { status: 401 });

    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Events are handled one by one, in order, so a join and the first message of a group
    // don't race. A failing handler is logged and doesn't stop the others; LINE still gets
    // 200 so it doesn't redeliver events that already went through.
    for (const event of body.events ?? []) {
      const handler = options.handlers[event.type];
      if (!handler) continue;
      try {
        // Recorded before handling: if a handler crashes halfway, a redelivery is skipped
        // rather than risk creating a bill or payment twice.
        if (!(await options.processedEvents.markProcessed(event.webhookEventId))) continue;
        await handler(event);
      } catch (error) {
        logError(`Handler for ${event.type} event ${event.webhookEventId} failed`, error);
      }
    }
    return new Response("OK", { status: 200 });
  };
}
