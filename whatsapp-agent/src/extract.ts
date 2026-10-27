import Anthropic from "@anthropic-ai/sdk";

/** One lease transaction as read from a (screenshot of a) LinkedIn post. */
export interface Deal {
  tenant: string | null;
  building: string | null;
  address: string | null;
  city: string | null;
  size_sqm: number | null;
  post_date: string | null;
  transaction_date: string | null;
  tenant_broker: string | null;
  leasing_brokers: string[];
  lease_type: string | null;
  notes: string | null;
  uncertain_fields: string[];
}

export interface Extraction {
  deals: Deal[];
  /** Why nothing was extracted, when `deals` is empty. */
  skipped_reason: string | null;
}

export type Media = { mediaType: string; data: Buffer };

const nullableString = { type: ["string", "null"] };

const DEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["deals", "skipped_reason"],
  properties: {
    deals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "tenant",
          "building",
          "address",
          "city",
          "size_sqm",
          "post_date",
          "transaction_date",
          "tenant_broker",
          "leasing_brokers",
          "lease_type",
          "notes",
          "uncertain_fields",
        ],
        properties: {
          tenant: nullableString,
          building: nullableString,
          address: nullableString,
          city: nullableString,
          size_sqm: { type: ["number", "null"] },
          post_date: nullableString,
          transaction_date: nullableString,
          tenant_broker: nullableString,
          leasing_brokers: { type: "array", items: { type: "string" } },
          lease_type: nullableString,
          notes: nullableString,
          uncertain_fields: { type: "array", items: { type: "string" } },
        },
      },
    },
    skipped_reason: nullableString,
  },
} as const;

const SYSTEM_PROMPT = `You extract office lease transactions in the Amsterdam market from screenshots or photos of LinkedIn posts (usually Dutch) and from pasted post text.

For every complete post that announces a lease transaction, return one deal:
- tenant: the company that leased the space (e.g. "PIDZ"). Use the short company name; drop taglines.
- building: the building or project name (e.g. "Diana & Vesta"). If only a street address is known, leave building null.
- address: street and number when shown anywhere, including in the image card (e.g. "Herikerbergweg 181-342").
- city: usually Amsterdam.
- size_sqm: lettable area in m² as a number ("circa 940 m²" -> 940). For a range, use the upper figure and mention the range in notes.
- post_date: the date the post was published, as YYYY-MM-DD. LinkedIn often omits the year ("Oct 8") - assume the most recent such date on or before the message date you are given. Relative dates ("3d", "1w") count back from the message date.
- transaction_date: only if the post states when the lease was signed or starts, as YYYY-MM-DD (or YYYY-MM if no day). Otherwise null.
- tenant_broker: the brokerage that represented the tenant. This is normally the company or person who published the post ("Namens Flexas.com hebben we PIDZ begeleid"). Give the firm name, not an individual's.
- leasing_brokers: brokerage firm(s) that acted for the landlord/owner ("trad op namens verhuurder", "verhuurmakelaar"). Firm names only; put named individuals in notes.
- lease_type: e.g. "conventional" (conventioneel) or "flex", only when stated.
- notes: short English notes with anything else useful: named contacts and their firm, landlord/owner, ranges, sublease, renewal.
- uncertain_fields: names of fields you had to guess or could not read clearly.

Rules:
- Ignore posts that are cut off at the edge of the image so that the deal cannot be identified, and posts that are not lease transactions (job posts, events, sales, investment deals without a tenant).
- Never invent values. Use null when something is not stated.
- If there is no usable deal, return an empty deals array and say why in skipped_reason.`;

const client = new Anthropic();

export async function extractDeals(input: {
  media: Media[];
  text: string;
  messageDate: Date;
}): Promise<Extraction> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const m of input.media) {
    const data = m.data.toString("base64");
    if (m.mediaType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: imageType(m.mediaType), data },
      });
    }
  }
  content.push({
    type: "text",
    text: [
      `Message date: ${input.messageDate.toISOString().slice(0, 10)}`,
      input.text
        ? `Text sent with the message:\n${input.text}`
        : "No text was sent with the message.",
    ].join("\n\n"),
  });

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: DEAL_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    return { deals: [], skipped_reason: "The model declined to read this message." };
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Extraction was cut off (max_tokens).");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Extraction returned no text.");
  return JSON.parse(text.text) as Extraction;
}

function imageType(mediaType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  switch (mediaType) {
    case "image/png":
    case "image/gif":
    case "image/webp":
      return mediaType;
    default:
      return "image/jpeg";
  }
}

export const SUPPORTED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
