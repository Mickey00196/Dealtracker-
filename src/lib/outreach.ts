import { supabase } from "@/integrations/supabase/client";
import { createLogEntry, type Company, type Stage } from "@/lib/pipeline";

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type OutreachStatus = "active" | "responded" | "parked" | "dead";

export type TouchOutcome =
  "no_answer" | "not_now" | "not_interested" | "responded" | "meeting_booked";

export type Touch = {
  id: string;
  company_id: string;
  outcome: TouchOutcome;
  touch_number: number;
  note: string;
  created_at: string;
};

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
 * Cadence
 *
 * Intervals are indexed by the touch number just completed. These are a first
 * guess — tune them against real response behaviour after a few weeks rather
 * than trusting them.
 * ------------------------------------------------------------------------- */

const CADENCE_DAYS: Record<number, number> = {
  1: 5,
  2: 10,
  3: 21,
};

/** Touch number after which a target is parked instead of chased again. */
export const MAX_TOUCHES = 4;

const PARK_DAYS = 182;
const RESPONDED_DAYS = 2;
const NOT_NOW_DAYS = 90;

export function addDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/* ---------------------------------------------------------------------------
 * Outcomes
 * ------------------------------------------------------------------------- */

export type OutcomeDefinition = {
  key: string;
  outcome: TouchOutcome;
  label: string;
  /** Short description shown in the outcome bar. */
  hint: string;
  /** Asks for a date before applying. */
  needsDate?: boolean;
};

export const OUTCOMES: OutcomeDefinition[] = [
  { key: "1", outcome: "no_answer", label: "No answer", hint: "chase again on cadence" },
  {
    key: "2",
    outcome: "not_now",
    label: "Not now",
    hint: "park until a date you pick",
    needsDate: true,
  },
  { key: "3", outcome: "not_interested", label: "Not interested", hint: "close and archive" },
  { key: "4", outcome: "responded", label: "Responded", hint: "reply landed, follow up in 2 days" },
  {
    key: "5",
    outcome: "meeting_booked",
    label: "Meeting booked",
    hint: "moves to the board",
    needsDate: true,
  },
];

export type CompanyPatch = Partial<Target>;

export type OutcomeResult = {
  patch: CompanyPatch;
  /** Prose written to the logbook alongside the structured touch row. */
  logBody: string;
  touchNumber: number;
};

/**
 * Works out what an outcome does to a company. Pure — no I/O — so the
 * cadence rules stay testable and the UI can preview the next date before
 * committing.
 *
 * `date` is required for outcomes where needsDate is true (an ISO string).
 */
export function applyOutcome(
  target: Target,
  outcome: TouchOutcome,
  note: string,
  date?: string,
): OutcomeResult {
  const now = new Date().toISOString();
  const touchNumber = target.touch_count + 1;

  const base: CompanyPatch = {
    touch_count: touchNumber,
    last_touch_at: now,
  };

  const suffix = note.trim() ? ` — ${note.trim()}` : "";

  switch (outcome) {
    case "no_answer": {
      // Exhausted the cadence: park rather than chase a name that isn't moving.
      if (touchNumber >= MAX_TOUCHES) {
        return {
          patch: {
            ...base,
            outreach_status: "parked",
            next_touch_at: addDays(PARK_DAYS),
          },
          logBody: `Touch ${touchNumber} — no answer. Parked after ${MAX_TOUCHES} attempts, revisit in six months.${suffix}`,
          touchNumber,
        };
      }
      const days = CADENCE_DAYS[touchNumber] ?? 21;
      return {
        patch: { ...base, next_touch_at: addDays(days) },
        logBody: `Touch ${touchNumber} — no answer. Next attempt in ${days} days.${suffix}`,
        touchNumber,
      };
    }

    case "not_now":
      return {
        patch: {
          ...base,
          outreach_status: "parked",
          next_touch_at: date ?? addDays(NOT_NOW_DAYS),
        },
        logBody: `Touch ${touchNumber} — not now. Parked until the date set.${suffix}`,
        touchNumber,
      };

    case "not_interested":
      return {
        patch: {
          ...base,
          outreach_status: "dead",
          next_touch_at: null,
          archived: true,
        },
        logBody: `Touch ${touchNumber} — not interested. Closed.${suffix}`,
        touchNumber,
      };

    case "responded":
      return {
        patch: {
          ...base,
          outreach_status: "responded",
          next_touch_at: addDays(RESPONDED_DAYS),
        },
        logBody: `Touch ${touchNumber} — responded.${suffix}`,
        touchNumber,
      };

    case "meeting_booked":
      return {
        patch: {
          ...base,
          outreach_status: "responded",
          stage: "searching" as Stage,
          next_touch_at: date ?? null,
        },
        logBody: `Touch ${touchNumber} — meeting booked. Moved to Searching.${suffix}`,
        touchNumber,
      };
  }
}

/* ---------------------------------------------------------------------------
 * Data access
 * ------------------------------------------------------------------------- */

export const outreachQueryKey = ["outreach"] as const;

export type OutreachData = {
  targets: Target[];
  touches: Touch[];
};

export async function fetchOutreach(): Promise<OutreachData> {
  const [targetsRes, touchesRes] = await Promise.all([
    supabase
      .from("companies")
      .select("*")
      .in("outreach_status", ["active", "parked"])
      .eq("archived", false),
    supabase.from("touches").select("*").order("created_at", { ascending: false }),
  ]);

  if (targetsRes.error) throw targetsRes.error;
  if (touchesRes.error) throw touchesRes.error;

  return {
    targets: (targetsRes.data ?? []) as unknown as Target[],
    touches: (touchesRes.data ?? []) as unknown as Touch[],
  };
}

/**
 * Records a touch: writes the structured row, patches the company, and
 * appends the prose log entry. Three writes rather than one transaction —
 * acceptable for a single-user tool, but if a touch ever half-applies this
 * is the place to look.
 */
export async function recordTouch(
  target: Target,
  outcome: TouchOutcome,
  note: string,
  date?: string,
): Promise<void> {
  const result = applyOutcome(target, outcome, note, date);

  const { error: touchError } = await supabase.from("touches").insert({
    company_id: target.id,
    outcome,
    touch_number: result.touchNumber,
    note: note.trim(),
  } as never);
  if (touchError) throw touchError;

  const { error: companyError } = await supabase
    .from("companies")
    .update(result.patch as never)
    .eq("id", target.id);
  if (companyError) throw companyError;

  await createLogEntry(target.id, result.logBody);
}

/** Sets a next-touch date by hand, without recording a touch. */
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
 * Stats
 * ------------------------------------------------------------------------- */

export type OutreachStats = {
  touchesThisWeek: number;
  repliesThisWeek: number;
  meetingsThisMonth: number;
};

function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeStats(touches: Touch[], now = new Date()): OutreachStats {
  const weekStart = startOfWeek(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const thisWeek = touches.filter((t) => t.created_at >= weekStart);

  return {
    touchesThisWeek: thisWeek.length,
    repliesThisWeek: thisWeek.filter(
      (t) => t.outcome === "responded" || t.outcome === "meeting_booked",
    ).length,
    meetingsThisMonth: touches.filter(
      (t) => t.created_at >= monthStart && t.outcome === "meeting_booked",
    ).length,
  };
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

export function formatLastTouch(iso: string | null, now = new Date()): string {
  if (!iso) return "never";
  const days = Math.round((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
