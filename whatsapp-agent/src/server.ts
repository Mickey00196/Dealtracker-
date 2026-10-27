import { config, excelConfigured } from "./config";
import { extractDeals, SUPPORTED_MEDIA, type Deal, type Media } from "./extract";
import { addRow, readTable, updateRow } from "./excel";
import { dealToValues, findDuplicate, mapColumns, mergeRow, toRow } from "./sheet";
import { downloadMedia, sendWhatsApp, validSignature } from "./twilio";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Messages are handled one at a time so two photos of the same deal sent
// together can't both miss the duplicate check and add two rows.
let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>) {
  queue = queue.then(job).catch((err) => console.error(err));
}

Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/whatsapp" || req.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const params = Object.fromEntries(new URLSearchParams(await req.text()));
    const webhookUrl = config.webhookUrl || publicUrl(req);
    if (!validSignature(req.headers.get("x-twilio-signature") ?? "", webhookUrl, params)) {
      console.warn(`Rejected request with bad Twilio signature (expected URL ${webhookUrl})`);
      return new Response("Forbidden", { status: 403 });
    }

    // Twilio times out after 15s, so acknowledge now and reply when done.
    enqueue(() => handleMessage(params));
    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  },
});

console.log(`WhatsApp deal agent listening on :${config.port}`);
if (!excelConfigured())
  console.log("Excel is not configured yet: deals will be extracted and replied, not saved.");

/** Railway terminates TLS in front of the app, so rebuild the URL Twilio used. */
function publicUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

async function handleMessage(params: Record<string, string>) {
  const from = params["From"] ?? "";
  if (!config.allowedSenders.includes(from)) {
    console.warn(`Ignored message from ${from}: not in ALLOWED_SENDERS`);
    await sendWhatsApp(
      from,
      `This number (${from.replace("whatsapp:", "")}) is not allowed to add deals.`,
    );
    return;
  }

  const text = (params["Body"] ?? "").trim();
  if (/^(help|\?)$/i.test(text)) {
    await sendWhatsApp(
      from,
      "Send a screenshot or photo of a LinkedIn deal post (or paste its text) and I'll add the transaction to the Excel sheet.",
    );
    return;
  }

  try {
    const media: Media[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < Number(params["NumMedia"] ?? 0); i++) {
      const mediaUrl = params[`MediaUrl${i}`];
      const mediaType = (params[`MediaContentType${i}`] ?? "").split(";")[0]!;
      if (!mediaUrl) continue;
      if (!SUPPORTED_MEDIA.has(mediaType)) {
        skipped.push(mediaType || "unknown file");
        continue;
      }
      const data = await downloadMedia(mediaUrl);
      if (mediaType !== "application/pdf" && data.length > MAX_IMAGE_BYTES) {
        skipped.push("an image over 5 MB");
        continue;
      }
      media.push({ mediaType, data });
    }

    if (!media.length && text.length < 40) {
      const why = skipped.length ? `I can't read ${skipped.join(", ")}. ` : "";
      await sendWhatsApp(from, `${why}Send a screenshot or photo of the post, or paste its text.`);
      return;
    }

    const result = await extractDeals({ media, text, messageDate: new Date() });
    if (!result.deals.length) {
      await sendWhatsApp(from, `⚠️ No transaction found. ${result.skipped_reason ?? ""}`.trim());
      return;
    }

    const lines: string[] = [];
    for (const deal of result.deals) lines.push(await saveDeal(deal, from));
    if (!excelConfigured()) lines.push("\n(Excel not connected yet: nothing was saved.)");
    await sendWhatsApp(from, lines.join("\n\n"));
  } catch (err) {
    console.error(err);
    await sendWhatsApp(
      from,
      `❌ Something went wrong, nothing was saved: ${(err as Error).message.slice(0, 300)}`,
    );
  }
}

async function saveDeal(deal: Deal, sender: string): Promise<string> {
  const summary = describe(deal);
  if (!excelConfigured()) return `🔎 ${summary}`;

  const { headers, rows } = await readTable();
  const columns = mapColumns(headers, config.excel.columnMap);
  const values = dealToValues(deal, {
    sender: sender.replace("whatsapp:", ""),
    addedAt: new Date(),
  });
  const incoming = toRow(columns, values);

  const dup = findDuplicate(columns, rows, values);
  if (dup >= 0) {
    const { row, changed } = mergeRow(columns, rows[dup]!, incoming);
    if (changed) {
      await updateRow(dup, row);
      return `🔁 Already in the sheet, added the missing details:\n${summary}`;
    }
    return `ℹ️ Already in the sheet, nothing new:\n${summary}`;
  }
  await addRow(incoming);
  return `✅ Added:\n${summary}`;
}

function describe(d: Deal): string {
  const parts = [
    `*${d.tenant ?? "Unknown tenant"}*`,
    `🏢 ${[d.building, d.address].filter(Boolean).join(", ") || "building unknown"}`,
    `📐 ${d.size_sqm != null ? `${d.size_sqm.toLocaleString("nl-NL")} m²` : "size unknown"}`,
    `📅 ${d.transaction_date ?? d.post_date ?? "date unknown"}`,
    `🤝 Tenant broker: ${d.tenant_broker ?? "?"}`,
    `🔑 Leasing broker: ${d.leasing_brokers.join(", ") || "?"}`,
  ];
  if (d.uncertain_fields.length) parts.push(`⚠️ Please check: ${d.uncertain_fields.join(", ")}`);
  return parts.join("\n");
}
