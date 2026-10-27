import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

/**
 * Twilio request signature: HMAC-SHA1 over the full webhook URL followed by
 * every POST parameter (sorted by name) as name+value, base64 encoded.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const expected = Buffer.from(twilioSignature(config.twilio.authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function basicAuth(): string {
  return (
    "Basic " +
    Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64")
  );
}

export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: basicAuth() }, redirect: "follow" });
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** WhatsApp messages via Twilio are capped at 1600 characters. */
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: basicAuth() },
        body: new URLSearchParams({ From: config.twilio.from, To: to, Body: body.slice(0, 1600) }),
      },
    );
    if (!res.ok) console.error(`Twilio send failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    // A failed reply must not be mistaken for a failed save.
    console.error("Twilio send failed:", err);
  }
}
