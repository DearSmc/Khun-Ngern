// The subset of LINE Messaging API webhook types the bot uses.

export interface EventSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface WebhookEvent {
  type: string;
  webhookEventId: string;
  timestamp: number;
  mode?: "active" | "standby";
  source?: EventSource;
  replyToken?: string;
  deliveryContext?: { isRedelivery: boolean };
  [key: string]: unknown;
}

export interface WebhookBody {
  destination: string;
  events: WebhookEvent[];
}
