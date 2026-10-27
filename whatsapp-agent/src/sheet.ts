import type { Deal } from "./extract";

/**
 * Pure spreadsheet logic: mapping deal fields onto the sheet's own column
 * headers and finding/merging duplicate rows. Kept free of I/O so it can be
 * unit tested; excel.ts does the Microsoft Graph calls.
 */

export type Field =
  | "tenant"
  | "building"
  | "address"
  | "city"
  | "size_sqm"
  | "post_date"
  | "transaction_date"
  | "tenant_broker"
  | "leasing_brokers"
  | "lease_type"
  | "notes"
  | "sender"
  | "added_at";

export type Cell = string | number | boolean | null;

/** Header names (normalised) recognised for each field, English and Dutch. */
const ALIASES: Record<Field, string[]> = {
  tenant: [
    "company",
    "company name",
    "tenant",
    "huurder",
    "bedrijf",
    "bedrijfsnaam",
    "naam bedrijf",
    "gebruiker",
  ],
  building: [
    "building",
    "building name",
    "location",
    "gebouw",
    "locatie",
    "object",
    "pand",
    "naam gebouw",
    "project",
  ],
  address: ["address", "adres", "straat", "street"],
  city: ["city", "plaats", "stad"],
  size_sqm: [
    "size",
    "size sqm",
    "size sq m",
    "sqm",
    "sq m",
    "m2",
    "m²",
    "oppervlakte",
    "metrage",
    "vvo",
    "size m2",
  ],
  post_date: ["date", "post date", "datum", "datum post", "posted"],
  transaction_date: [
    "transaction date",
    "deal date",
    "datum transactie",
    "transactiedatum",
    "ingangsdatum",
  ],
  tenant_broker: [
    "tenant broker",
    "tenant rep",
    "broker",
    "huurdersmakelaar",
    "aanhuurmakelaar",
    "makelaar huurder",
    "broker tenant",
  ],
  leasing_brokers: [
    "leasing broker",
    "leasing brokers",
    "landlord broker",
    "verhuurmakelaar",
    "makelaar verhuurder",
    "broker landlord",
  ],
  lease_type: ["lease type", "type", "huurtype", "type huur"],
  notes: ["notes", "opmerkingen", "notities", "remarks", "toelichting"],
  sender: ["sent by", "source", "bron", "ingestuurd door"],
  added_at: ["added", "added at", "toegevoegd", "captured"],
};

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9²]+/g, " ")
    .trim();
}

/**
 * Work out which column holds which field. `overrides` (header -> field) wins
 * over the built-in aliases, for headers the aliases don't cover.
 */
export function mapColumns(
  headers: string[],
  overrides: Record<string, Field> = {},
): (Field | null)[] {
  const normOverrides = new Map(Object.entries(overrides).map(([h, f]) => [normalise(h), f]));
  const used = new Set<Field>();
  return headers.map((header) => {
    const h = normalise(header);
    const override = normOverrides.get(h);
    if (override) {
      used.add(override);
      return override;
    }
    for (const field of Object.keys(ALIASES) as Field[]) {
      if (!used.has(field) && ALIASES[field].includes(h)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}

export function dealToValues(
  deal: Deal,
  extra: { sender: string; addedAt: Date },
): Record<Field, Cell> {
  return {
    tenant: deal.tenant,
    building: deal.building,
    address: deal.address,
    city: deal.city,
    size_sqm: deal.size_sqm,
    post_date: deal.post_date,
    transaction_date: deal.transaction_date,
    tenant_broker: deal.tenant_broker,
    leasing_brokers: deal.leasing_brokers.length ? deal.leasing_brokers.join(", ") : null,
    lease_type: deal.lease_type,
    notes: deal.notes,
    sender: extra.sender,
    added_at: extra.addedAt.toISOString().slice(0, 16).replace("T", " "),
  };
}

export function toRow(columns: (Field | null)[], values: Record<Field, Cell>): Cell[] {
  return columns.map((f) => (f ? (values[f] ?? "") : ""));
}

const COMPANY_SUFFIXES =
  /\b(b ?v|n ?v|bv|nv|ltd|gmbh|inc|holding|group|groep|nederland|netherlands)\b/g;

function key(s: Cell): string {
  return normalise(String(s ?? ""))
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameOrContains(a: string, b: string): boolean {
  return a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)));
}

/**
 * Index of an existing row describing the same deal, or -1. Same tenant, and
 * the same building/address when both rows know it. The same deal is often
 * posted by both the tenant's and the landlord's broker.
 */
export function findDuplicate(
  columns: (Field | null)[],
  rows: Cell[][],
  values: Record<Field, Cell>,
): number {
  const tenantCol = columns.indexOf("tenant");
  if (tenantCol < 0 || !key(values.tenant)) return -1;
  const placeCols = (["building", "address"] as const).map((f) => columns.indexOf(f));

  return rows.findIndex((row) => {
    if (!sameOrContains(key(row[tenantCol] ?? null), key(values.tenant))) return false;
    let compared = false;
    for (const [i, field] of (["building", "address"] as const).entries()) {
      const col = placeCols[i]!;
      if (col < 0) continue;
      const existing = key(row[col] ?? null);
      const incoming = key(values[field]);
      if (!existing || !incoming) continue;
      compared = true;
      if (sameOrContains(existing, incoming)) return true;
    }
    return !compared;
  });
}

/** Fill empty cells of an existing row; the leasing-brokers cell is unioned. */
export function mergeRow(
  columns: (Field | null)[],
  existing: Cell[],
  incoming: Cell[],
): { row: Cell[]; changed: boolean } {
  let changed = false;
  const row = existing.map((cell, i) => {
    const field = columns[i];
    const next = incoming[i];
    if (!field || field === "sender" || field === "added_at" || next === "" || next == null)
      return cell;
    if (cell === "" || cell == null) {
      changed = true;
      return next;
    }
    if (field === "leasing_brokers") {
      const parts = String(cell).split(/\s*,\s*/);
      const add = String(next)
        .split(/\s*,\s*/)
        .filter((p) => !parts.some((q) => sameOrContains(key(q), key(p))));
      if (add.length) {
        changed = true;
        return [...parts, ...add].join(", ");
      }
    }
    return cell;
  });
  return { row, changed };
}
