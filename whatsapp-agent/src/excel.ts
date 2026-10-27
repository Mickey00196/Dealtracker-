import { config } from "./config";
import type { Cell } from "./sheet";

/**
 * Minimal Microsoft Graph client for one Excel table in OneDrive/SharePoint,
 * using an Entra app registration (client credentials, application
 * permission Files.ReadWrite.All or Sites.Selected).
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

let token: { value: string; expiresAt: number } | null = null;
let tableBase: string | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const { tenantId, clientId, clientSecret } = config.microsoft;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft login failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function graph<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok)
    throw new Error(
      `Graph ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`,
    );
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Graph "shares" id for a sharing link: u! + unpadded base64url of the URL. */
export function shareId(url: string): string {
  return "u!" + Buffer.from(url).toString("base64url");
}

async function table(): Promise<string> {
  if (tableBase) return tableBase;
  const { shareUrl, driveId, itemId, tableName } = config.excel;
  let item: string;
  if (driveId && itemId) {
    item = `/drives/${driveId}/items/${itemId}`;
  } else {
    const found = await graph<{ id: string; parentReference: { driveId: string } }>(
      `/shares/${shareId(shareUrl)}/driveItem`,
    );
    item = `/drives/${found.parentReference.driveId}/items/${found.id}`;
  }
  let name = tableName;
  if (!name) {
    const tables = await graph<{ value: { name: string }[] }>(`${item}/workbook/tables`);
    const first = tables.value[0];
    if (!first)
      throw new Error("The workbook has no Excel table. Select the data and use Insert > Table.");
    name = first.name;
  }
  tableBase = `${item}/workbook/tables/${encodeURIComponent(name)}`;
  return tableBase;
}

export async function readTable(): Promise<{ headers: string[]; rows: Cell[][] }> {
  const base = await table();
  const header = await graph<{ values: Cell[][] }>(`${base}/headerRowRange`);
  const rows = await graph<{ value: { values: Cell[][] }[] }>(`${base}/rows`);
  return {
    headers: (header.values[0] ?? []).map((h) => String(h ?? "")),
    rows: rows.value.map((r) => r.values[0] ?? []),
  };
}

export async function addRow(row: Cell[]): Promise<void> {
  await graph(`${await table()}/rows/add`, { method: "POST", body: { values: [row] } });
}

export async function updateRow(index: number, row: Cell[]): Promise<void> {
  await graph(`${await table()}/rows/itemAt(index=${index})`, {
    method: "PATCH",
    body: { values: [row] },
  });
}
