// Verifies the x-line-signature header: base64(HMAC-SHA256(channel secret, raw body)).
// Uses Web Crypto so it runs unchanged in Deno, Node and browsers.

const encoder = new TextEncoder();

export async function verifyLineSignature(
  channelSecret: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!channelSecret) throw new Error("LINE channel secret is not configured");
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const given = decodeBase64(signature);
  return given !== null && constantTimeEqual(expected, given);
}

function decodeBase64(text: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
