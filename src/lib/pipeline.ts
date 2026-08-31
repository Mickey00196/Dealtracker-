import { supabase } from "@/integrations/supabase/client";

export const STAGES = ["targeting", "searching", "viewing", "negotiating", "closed"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  targeting: "Targeting",
  searching: "Searching",
  viewing: "Viewing",
  negotiating: "Negotiating",
  closed: "Closed",
};

export const STAGE_COLOR_VAR: Record<Stage, string> = {
  targeting: "var(--stage-targeting)",
  searching: "var(--stage-searching)",
  viewing: "var(--stage-viewing)",
  negotiating: "var(--stage-negotiating)",
  closed: "var(--stage-closed)",
};

export type Company = {
  id: string;
  name: string;
  stage: Stage;
  size_sqm_min: number | null;
  size_sqm_max: number | null;
  preferred_areas: string;
  target_move_date: string | null;
  budget_per_year: number | null;
  target_rent_per_sqm: number | null;
  office_requirements: string;
  notes: string;
  contact_name: string | null;
  contact_email: string | null;
  follow_up_at: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type LogEntry = {
  id: string;
  company_id: string;
  body: string;
  created_at: string;
};

export type PipelineData = {
  companies: Company[];
  entries: LogEntry[];
};

export const pipelineQueryKey = ["pipeline"] as const;

export async function fetchPipeline(): Promise<PipelineData> {
  const [companiesRes, entriesRes] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: false }),
    supabase.from("log_entries").select("*").order("created_at", { ascending: false }),
  ]);
  if (companiesRes.error) throw companiesRes.error;
  if (entriesRes.error) throw entriesRes.error;
  return {
    companies: (companiesRes.data ?? []) as unknown as Company[],
    entries: (entriesRes.data ?? []) as unknown as LogEntry[],
  };
}

export async function updateCompany(id: string, patch: Partial<Company>) {
  const { error } = await supabase.from("companies").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createCompany(patch: Partial<Company>): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert(patch as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Company;
}

export async function createLogEntry(companyId: string, body: string): Promise<LogEntry> {
  const { data, error } = await supabase
    .from("log_entries")
    .insert({ company_id: companyId, body } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as LogEntry;
}

/* ---------- derived helpers ---------- */

export function lastActivityMap(data: PipelineData): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of data.companies) map[c.id] = c.created_at;
  for (const e of data.entries) {
    const current = map[e.company_id];
    if (!current || e.created_at > current) map[e.company_id] = e.created_at;
  }
  return map;
}

export const STALE_DAYS = 14;

export function isStale(iso: string, now = Date.now()) {
  return now - new Date(iso).getTime() > STALE_DAYS * 86_400_000;
}

export function isFollowUpOverdue(iso: string, now = Date.now()) {
  return new Date(iso).getTime() <= now;
}

/**
 * Companies with a follow-up date float to the top of their column, soonest
 * (or most overdue) first, since a pending follow-up means action is required.
 */
export function byFollowUpThenActivity(lastActivity: Record<string, string>) {
  return (a: Company, b: Company) => {
    if (a.follow_up_at && b.follow_up_at) {
      return a.follow_up_at.localeCompare(b.follow_up_at);
    }
    if (a.follow_up_at) return -1;
    if (b.follow_up_at) return 1;
    return (lastActivity[b.id] ?? b.created_at).localeCompare(lastActivity[a.id] ?? a.created_at);
  };
}

export const nf = new Intl.NumberFormat("de-DE");

export function indicativeRentLine(
  rentPerSqm: number | null,
  min: number | null,
  max: number | null,
  budget: number | null,
): { text: string; overBudget: boolean } | null {
  if (rentPerSqm == null) return null;
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo == null || hi == null) return null;
  const low = lo * rentPerSqm;
  const high = hi * rentPerSqm;
  const range = low === high ? `€ ${nf.format(low)}` : `€ ${nf.format(low)} – € ${nf.format(high)}`;
  const overBudget = budget != null && low > budget;
  return {
    text: `Indicative: ${range} / year at ${nf.format(rentPerSqm)} €/m²`,
    overBudget,
  };
}

export function formatSize(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${nf.format(min)} m²` : `${nf.format(min)}–${nf.format(max)} m²`;
  }
  if (min != null) return `from ${nf.format(min)} m²`;
  return `up to ${nf.format(max as number)} m²`;
}

export function formatAbsolute(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", ",");
}

/** Converts a stored ISO timestamp to the local value a `datetime-local` input expects. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a `datetime-local` input value (local time, no timezone) to an ISO timestamp. */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatFollowUp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

/* ---------- search ---------- */

export type SearchHit = {
  company: Company;
  field: string;
  snippet: string;
  matchStart: number;
  matchLength: number;
};

function makeSnippet(text: string, index: number, term: number) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + term + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return {
    snippet: prefix + text.slice(start, end).replace(/\s+/g, " ") + suffix,
    matchStart: prefix.length + (index - start),
  };
}

export function searchPipeline(data: PipelineData, rawQuery: string): SearchHit[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const byId = new Map(data.companies.map((c) => [c.id, c]));
  const hits: SearchHit[] = [];

  const push = (company: Company, field: string, text: string | null) => {
    if (!text) return;
    const index = text.toLowerCase().indexOf(q);
    if (index === -1) return;
    const { snippet, matchStart } = makeSnippet(text, index, q.length);
    hits.push({ company, field, snippet, matchStart, matchLength: q.length });
  };

  for (const c of data.companies) {
    push(c, "Name", c.name);
    push(c, "Background", c.notes);
    push(c, "Office requirements", c.office_requirements);
    push(c, "Preferred areas", c.preferred_areas);
    push(c, "Contact", c.contact_name);
  }
  for (const e of data.entries) {
    const c = byId.get(e.company_id);
    if (c) push(c, "Log entry", e.body);
  }
  return hits;
}
