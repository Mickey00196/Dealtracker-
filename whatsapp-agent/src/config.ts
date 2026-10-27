import type { Field } from "./sheet";

const env = (name: string) => process.env[name]?.trim() ?? "";

function parseColumnMap(raw: string): Record<string, Field> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Field>;
  } catch {
    throw new Error('COLUMN_MAP must be JSON, e.g. {"Huurder":"tenant"}');
  }
}

export const config = {
  port: Number(env("PORT") || 3000),
  /** Public URL Twilio posts to, e.g. https://xyz.up.railway.app/whatsapp. */
  webhookUrl: env("TWILIO_WEBHOOK_URL"),
  twilio: {
    accountSid: env("TWILIO_ACCOUNT_SID"),
    authToken: env("TWILIO_AUTH_TOKEN"),
    /** The bot's own number, e.g. whatsapp:+14155238886. */
    from: env("TWILIO_WHATSAPP_FROM"),
  },
  /** Senders allowed to add deals, e.g. whatsapp:+31612345678. Empty = anyone. */
  allowedSenders: env("ALLOWED_SENDERS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("whatsapp:") ? s : `whatsapp:${s}`)),
  microsoft: {
    tenantId: env("MS_TENANT_ID"),
    clientId: env("MS_CLIENT_ID"),
    clientSecret: env("MS_CLIENT_SECRET"),
  },
  excel: {
    /** A sharing link to the workbook, or set EXCEL_DRIVE_ID + EXCEL_ITEM_ID. */
    shareUrl: env("EXCEL_SHARE_URL"),
    driveId: env("EXCEL_DRIVE_ID"),
    itemId: env("EXCEL_ITEM_ID"),
    /** Defaults to the first table in the workbook. */
    tableName: env("EXCEL_TABLE"),
    columnMap: parseColumnMap(env("COLUMN_MAP")),
  },
};

export const excelConfigured = () =>
  Boolean(
    config.microsoft.tenantId &&
    config.microsoft.clientId &&
    config.microsoft.clientSecret &&
    (config.excel.shareUrl || (config.excel.driveId && config.excel.itemId)),
  );
