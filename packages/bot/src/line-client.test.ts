import { describe, expect, it, vi } from "vitest";
import { createLineClient, LineApiError } from "./line-client.ts";

const text = (t: string) => ({ type: "text", text: t });

function fakeFetch(status = 200, body: unknown = {}) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

describe("createLineClient", () => {
  it("refuses to start without an access token", () => {
    expect(() => createLineClient({ channelAccessToken: "" })).toThrow();
  });

  it("sends a reply with the token and messages", async () => {
    const fetch = fakeFetch();
    const client = createLineClient({ channelAccessToken: "tok", fetch });
    await client.reply("reply-1", [text("สวัสดี")]);

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.line.me/v2/bot/message/reply");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
    expect(JSON.parse(String(init?.body))).toEqual({
      replyToken: "reply-1",
      messages: [{ type: "text", text: "สวัสดี" }],
    });
  });

  it("reports successful pushes for quota tracking, but not replies", async () => {
    const onPush = vi.fn();
    const client = createLineClient({ channelAccessToken: "tok", fetch: fakeFetch(), onPush });
    await client.reply("r", [text("a")]);
    await client.push("Cgroup", [text("a"), text("b")]);
    expect(onPush).toHaveBeenCalledExactlyOnceWith("Cgroup", 2);
  });

  it("sends the retry key and treats 409 as already delivered", async () => {
    const onPush = vi.fn();
    const fetch = fakeFetch(409, { message: "The retry key is already accepted" });
    const client = createLineClient({ channelAccessToken: "tok", fetch, onPush });

    await expect(client.push("Cgroup", [text("a")], "key-1")).resolves.toBeUndefined();
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("X-Line-Retry-Key")).toBe("key-1");
    expect(onPush).not.toHaveBeenCalled();
  });

  it("throws LineApiError with the status and body on failure", async () => {
    const client = createLineClient({
      channelAccessToken: "tok",
      fetch: fakeFetch(400, { message: "Invalid reply token" }),
    });
    const error = await client.reply("bad", [text("a")]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LineApiError);
    expect(error).toMatchObject({ status: 400, endpoint: "reply" });
  });

  it.each([0, 6])("rejects %i messages without calling LINE", async (count) => {
    const fetch = fakeFetch();
    const client = createLineClient({ channelAccessToken: "tok", fetch });
    const messages = Array.from({ length: count }, () => text("a"));
    await expect(client.push("Cgroup", messages)).rejects.toThrow(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a group member profile", async () => {
    const profile = { userId: "Uuser", displayName: "เพื่อน A", pictureUrl: "https://x.test/a" };
    const fetch = fakeFetch(200, profile);
    const client = createLineClient({ channelAccessToken: "tok", fetch });

    expect(await client.getGroupMemberProfile("Cgroup", "Uuser")).toEqual(profile);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.line.me/v2/bot/group/Cgroup/member/Uuser");
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("returns null for someone who is not in the group", async () => {
    const client = createLineClient({ channelAccessToken: "tok", fetch: fakeFetch(404, "{}") });
    expect(await client.getGroupMemberProfile("Cgroup", "Ugone")).toBeNull();
  });
});
