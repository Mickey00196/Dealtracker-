import { supabase } from "@/integrations/supabase/client";
import { createCompany, type Company } from "@/lib/pipeline";

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type OutreachStatus = "active" | "responded" | "parked" | "dead";

/** The fields added to `companies` by migration 0001. */
export type OutreachFields = {
  outreach_status: OutreachStatus;
  touch_count: number;
  last_touch_at: string | null;
  next_touch_at: string | null;
  employee_count: number | null;
  industry: string;
  website: string;
};

export type Target = Company & OutreachFields;

/* ---------------------------------------------------------------------------
 * Data access
 *
 * There's no structured touch/cadence engine here — a "touch" is just a
 * logbook entry (shared with the pipeline's log_entries table) plus, when it
 * matters, a next-touch date set by hand. Simpler to read, and the logbook
 * still tells the story of what happened.
 * ------------------------------------------------------------------------- */

export const outreachQueryKey = ["outreach"] as const;

export async function fetchOutreach(): Promise<Target[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .in("outreach_status", ["active", "parked"])
    .eq("archived", false);
  if (error) throw error;
  return (data ?? []) as unknown as Target[];
}

export async function createTarget(name: string): Promise<Target> {
  const company = await createCompany({
    name,
    stage: "targeting",
    outreach_status: "active",
  });
  return company as Target;
}

/** Sets a next-touch date by hand. */
export async function setNextTouch(id: string, iso: string | null): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ next_touch_at: iso } as never)
    .eq("id", id);
  if (error) throw error;
}

/* ---------------------------------------------------------------------------
 * Queue ordering and derived state
 * ------------------------------------------------------------------------- */

export type DueState = "overdue" | "today" | "scheduled" | "unscheduled";

export function dueState(target: Target, now = new Date()): DueState {
  if (!target.next_touch_at) return "unscheduled";
  const due = new Date(target.next_touch_at);
  if (due <= now) return "overdue";
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return due <= endOfDay ? "today" : "scheduled";
}

const DUE_ORDER: Record<DueState, number> = {
  overdue: 0,
  today: 1,
  unscheduled: 2,
  scheduled: 3,
};

/**
 * Overdue first, then today, then targets with no date at all — an
 * unscheduled target is one that has quietly fallen out of the cadence, so it
 * sits above future work rather than below it.
 */
export function sortQueue(targets: Target[], now = new Date()): Target[] {
  return [...targets].sort((a, b) => {
    const byState = DUE_ORDER[dueState(a, now)] - DUE_ORDER[dueState(b, now)];
    if (byState !== 0) return byState;
    if (a.next_touch_at && b.next_touch_at) {
      return a.next_touch_at.localeCompare(b.next_touch_at);
    }
    return a.name.localeCompare(b.name);
  });
}

/** Targets that need attention now — what the header count reflects. */
export function dueTargets(targets: Target[], now = new Date()): Target[] {
  return targets.filter((t) => {
    const state = dueState(t, now);
    return state === "overdue" || state === "today" || state === "unscheduled";
  });
}

/* ---------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------- */

const nf = new Intl.NumberFormat("nl-NL");

export function formatHeadcount(n: number | null): string {
  return n == null ? "—" : nf.format(n);
}

/** Compact relative time for dense table rows: "3d ago", "in 5d", "today". */
export function formatDue(iso: string | null, now = new Date()): string {
  if (!iso) return "not set";
  const diffMs = new Date(iso).getTime() - now.getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
