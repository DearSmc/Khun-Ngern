// Thin wrapper around the LINE Messaging API. Every call to LINE goes through here.
// Replies are free; pushes count against the OA's monthly quota (PRD §6 Push quota),
// so pushes are reported through `onPush` for tracking.

const API = "https://api.line.me/v2/bot";

/** A LINE message object (text, flex, ...). Kept loose; builders produce the exact shapes. */
export type LineMessage = { type: string } & Record<string, unknown>;

export interface MemberProfile {
  displayName: string;
  userId: string;
  pictureUrl?: string;
}

export interface LineClient {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  /** `retryKey` (a UUID) lets a retried push be accepted only once by LINE. */
  push(to: string, messages: LineMessage[], retryKey?: string): Promise<void>;
  /** Returns null when the user is not (or no longer) in the group. */
  getGroupMemberProfile(groupId: string, userId: string): Promise<MemberProfile | null>;
}

export interface LineClientOptions {
  channelAccessToken: string;
  fetch?: typeof fetch;
  /** Called after each successful push, with the target and number of messages. */
  onPush?: (to: string, messageCount: number) => void | Promise<void>;
}

export class LineApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly endpoint: string,
  ) {
    super(`LINE API ${endpoint} failed with ${status}: ${body}`);
    this.name = "LineApiError";
  }
}

export function createLineClient(options: LineClientOptions): LineClient {
  if (!options.channelAccessToken) throw new Error("LINE channel access token is not configured");
  const doFetch = options.fetch ?? fetch;

  async function call(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const res = await doFetch(`${API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.channelAccessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return res;
  }

  async function ensureOk(res: Response, endpoint: string): Promise<void> {
    if (!res.ok) throw new LineApiError(res.status, await res.text(), endpoint);
  }

  return {
    async reply(replyToken, messages) {
      assertMessageCount(messages);
      await ensureOk(await call("POST", "/message/reply", { replyToken, messages }), "reply");
    },

    async push(to, messages, retryKey) {
      assertMessageCount(messages);
      const res = await call(
        "POST",
        "/message/push",
        { to, messages },
        retryKey ? { "X-Line-Retry-Key": retryKey } : {},
      );
      // 409 means LINE already accepted a push with this retry key: not an error, not a new push.
      if (retryKey && res.status === 409) return;
      await ensureOk(res, "push");
      await options.onPush?.(to, messages.length);
    },

    async getGroupMemberProfile(groupId, userId) {
      const endpoint = `/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`;
      const res = await call("GET", endpoint);
      if (res.status === 404) return null;
      await ensureOk(res, "group member profile");
      return (await res.json()) as MemberProfile;
    },
  };
}

function assertMessageCount(messages: LineMessage[]): void {
  // LINE accepts 1 to 5 messages per reply or push.
  if (messages.length < 1 || messages.length > 5) {
    throw new RangeError(`LINE accepts 1 to 5 messages per call, got ${messages.length}`);
  }
}
