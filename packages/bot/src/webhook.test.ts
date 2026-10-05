import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { WebhookEvent } from "./line-types.ts";
import { createMemoryEventStore, type ProcessedEventStore } from "./processed-events.ts";
import { verifyLineSignature } from "./signature.ts";
import { createWebhookHandler } from "./webhook.ts";

const SECRET = "test-channel-secret";
const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("base64");

const event = (type: string, id = "evt-1"): WebhookEvent => ({
  type,
  webhookEventId: id,
  timestamp: 0,
  source: { type: "group", groupId: "Cgroup", userId: "Uuser" },
});

const post = (body: string, signature: string | null = sign(body)) =>
  new Request("https://example.test/webhook", {
    method: "POST",
    body,
    headers: signature === null ? {} : { "x-line-signature": signature },
  });

describe("verifyLineSignature", () => {
  it("accepts a signature made with the channel secret", async () => {
    const body = '{"events":[]}';
    expect(await verifyLineSignature(SECRET, body, sign(body))).toBe(true);
  });

  it("accepts Thai text in the body", async () => {
    const body = '{"text":"บิล ข้าวเย็น 300"}';
    expect(await verifyLineSignature(SECRET, body, sign(body))).toBe(true);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["from another secret", sign('{"events":[]}', "other-secret")],
    ["not base64", "%%%"],
  ])("rejects a signature that is %s", async (_, signature) => {
    expect(await verifyLineSignature(SECRET, '{"events":[]}', signature)).toBe(false);
  });

  it("rejects a body changed after signing", async () => {
    expect(await verifyLineSignature(SECRET, '{"events":[1]}', sign('{"events":[]}'))).toBe(false);
  });

  it("refuses to run without a channel secret", async () => {
    await expect(verifyLineSignature("", "{}", sign("{}"))).rejects.toThrow();
  });
});

describe("createWebhookHandler", () => {
  it("returns 401 for a wrong signature and runs no handler", async () => {
    const join = vi.fn(async () => {});
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: { join },
    });
    const body = JSON.stringify({ destination: "U", events: [event("join")] });

    expect((await handle(post(body, sign(body, "wrong")))).status).toBe(401);
    expect((await handle(post(body, null))).status).toBe(401);
    expect(join).not.toHaveBeenCalled();
  });

  it("returns 405 for anything but POST", async () => {
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: {},
    });
    expect((await handle(new Request("https://example.test/webhook"))).status).toBe(405);
  });

  it("returns 400 for a signed body that is not JSON", async () => {
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: {},
    });
    expect((await handle(post("not json"))).status).toBe(400);
  });

  it("returns 200 for LINE's empty verification request", async () => {
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: {},
    });
    const body = JSON.stringify({ destination: "U", events: [] });
    expect((await handle(post(body))).status).toBe(200);
  });

  it("dispatches each event to the handler for its type, in order", async () => {
    const calls: string[] = [];
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: {
        join: async (e) => void calls.push(`join:${e.webhookEventId}`),
        message: async (e) => void calls.push(`message:${e.webhookEventId}`),
      },
    });
    const body = JSON.stringify({
      destination: "U",
      events: [event("join", "a"), event("unfollow", "b"), event("message", "c")],
    });

    expect((await handle(post(body))).status).toBe(200);
    expect(calls).toEqual(["join:a", "message:c"]);
  });

  it("keeps going and still returns 200 when a handler throws", async () => {
    const logError = vi.fn();
    const message = vi.fn(async () => {});
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      logError,
      handlers: {
        join: async () => {
          throw new Error("boom");
        },
        message,
      },
    });
    const body = JSON.stringify({
      destination: "U",
      events: [event("join", "j"), event("message", "m")],
    });

    expect((await handle(post(body))).status).toBe(200);
    expect(message).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledOnce();
  });

  it("handles a redelivered event only once", async () => {
    const message = vi.fn(async () => {});
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: { message },
    });
    const first = JSON.stringify({ destination: "U", events: [event("message", "same")] });
    const redelivery = JSON.stringify({
      destination: "U",
      events: [{ ...event("message", "same"), deliveryContext: { isRedelivery: true } }],
    });

    expect((await handle(post(first))).status).toBe(200);
    expect((await handle(post(redelivery))).status).toBe(200);
    expect(message).toHaveBeenCalledOnce();
  });

  it("handles a duplicate inside the same request only once", async () => {
    const message = vi.fn(async () => {});
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents: createMemoryEventStore(),
      handlers: { message },
    });
    const body = JSON.stringify({
      destination: "U",
      events: [event("message", "x"), event("message", "x"), event("message", "y")],
    });

    await handle(post(body));
    expect(message).toHaveBeenCalledTimes(2);
  });

  it("does not record events that have no handler", async () => {
    const processedEvents: ProcessedEventStore = { markProcessed: vi.fn(async () => true) };
    const handle = createWebhookHandler({ channelSecret: SECRET, processedEvents, handlers: {} });
    const body = JSON.stringify({ destination: "U", events: [event("unfollow")] });

    await handle(post(body));
    expect(processedEvents.markProcessed).not.toHaveBeenCalled();
  });

  it("skips the event but keeps going when the store fails", async () => {
    const logError = vi.fn();
    const message = vi.fn(async () => {});
    let calls = 0;
    const processedEvents: ProcessedEventStore = {
      markProcessed: async () => {
        if (calls++ === 0) throw new Error("db down");
        return true;
      },
    };
    const handle = createWebhookHandler({
      channelSecret: SECRET,
      processedEvents,
      logError,
      handlers: { message },
    });
    const body = JSON.stringify({
      destination: "U",
      events: [event("message", "a"), event("message", "b")],
    });

    expect((await handle(post(body))).status).toBe(200);
    expect(message).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledOnce();
  });
});
