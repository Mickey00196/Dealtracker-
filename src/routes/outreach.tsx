import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OutcomeBar } from "@/components/OutcomeBar";
import { OutreachSession } from "@/components/OutreachSession";
import { OutreachTable } from "@/components/OutreachTable";
import { fetchPipeline, pipelineQueryKey, type LogEntry, type PipelineData } from "@/lib/pipeline";
import {
  computeStats,
  dueTargets,
  fetchOutreach,
  outreachQueryKey,
  recordTouch,
  sortQueue,
  type OutreachData,
  type Target,
  type TouchOutcome,
} from "@/lib/outreach";

export const Route = createFileRoute("/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach" },
      {
        name: "description",
        content: "Work the cold outreach queue: one keystroke logs a touch and schedules the next.",
      },
    ],
  }),
  component: OutreachPage,
});

function OutreachPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: outreachQueryKey,
    queryFn: fetchOutreach,
  });

  // Log entries live in the pipeline query; session mode shows the history.
  const { data: pipeline } = useQuery({
    queryKey: pipelineQueryKey,
    queryFn: fetchPipeline,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [dueOnly, setDueOnly] = useState(true);

  // A target becomes due through time passing, not through anything the user
  // clicks, so the view has to recompute on a timer or it goes stale.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const outreach: OutreachData = data ?? { targets: [], touches: [] };

  const queue = useMemo(() => sortQueue(outreach.targets, now), [outreach.targets, now]);
  const due = useMemo(() => dueTargets(queue, now), [queue, now]);
  const visible = dueOnly ? due : queue;
  const stats = useMemo(() => computeStats(outreach.touches, now), [outreach.touches, now]);

  const entriesFor = useCallback(
    (companyId: string): LogEntry[] =>
      (pipeline?.entries ?? [])
        .filter((e) => e.company_id === companyId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [pipeline],
  );

  const touchMutation = useMutation({
    mutationFn: ({
      target,
      outcome,
      note,
      date,
    }: {
      target: Target;
      outcome: TouchOutcome;
      note: string;
      date?: string;
    }) => recordTouch(target, outcome, note, date),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: outreachQueryKey });
      qc.invalidateQueries({ queryKey: pipelineQueryKey });
    },
  });

  const applyOutcomeAt = useCallback(
    (index: number, outcome: TouchOutcome, note: string, date?: string) => {
      const target = visible[index];
      if (!target) return;
      touchMutation.mutate({ target, outcome, note, ...(date !== undefined ? { date } : {}) });
      // The row leaves the due list once handled, so staying on the same
      // index lands on the next company without moving the cursor.
      setSelectedIndex((i) => Math.min(i, Math.max(0, visible.length - 2)));
    },
    [visible, touchMutation],
  );

  /* ----- keyboard: j/k or arrows to move, 1-5 to log ----- */
  useEffect(() => {
    if (sessionActive) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, visible.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "1" || e.key === "3" || e.key === "4") {
        // 2 and 5 need a date, so they go through the outcome bar UI.
        e.preventDefault();
        const map: Record<"1" | "3" | "4", TouchOutcome> = {
          "1": "no_answer",
          "3": "not_interested",
          "4": "responded",
        };
        applyOutcomeAt(selectedIndex, map[e.key], "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible.length, selectedIndex, applyOutcomeAt, sessionActive]);

  /* ----- session mode ----- */
  const sessionTarget = due[sessionIndex];

  function startSession() {
    if (due.length === 0) return;
    setSessionIndex(0);
    setSessionActive(true);
  }

  function sessionOutcome(outcome: TouchOutcome, note: string, date?: string) {
    if (!sessionTarget) return;
    touchMutation.mutate({
      target: sessionTarget,
      outcome,
      note,
      ...(date !== undefined ? { date } : {}),
    });
    advanceSession();
  }

  function advanceSession() {
    if (sessionIndex + 1 >= due.length) {
      setSessionActive(false);
      setSessionIndex(0);
    } else {
      setSessionIndex((i) => i + 1);
    }
  }

  if (sessionActive && sessionTarget) {
    return (
      <OutreachSession
        target={sessionTarget}
        entries={entriesFor(sessionTarget.id)}
        position={sessionIndex + 1}
        total={due.length}
        onOutcome={sessionOutcome}
        onSkip={advanceSession}
        onExit={() => setSessionActive(false)}
      />
    );
  }

  const selected = visible[selectedIndex];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-5 py-3">
          <h1 className="text-sm font-semibold tracking-[0.08em]">OUTREACH</h1>
          <Link
            to="/"
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-100 hover:text-foreground"
          >
            Board
          </Link>

          <div className="tnum ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span>{stats.touchesThisWeek} touches this week</span>
            <span>{stats.repliesThisWeek} replies</span>
            <span>{stats.meetingsThisMonth} meetings this month</span>
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => {
                setDueOnly(e.target.checked);
                setSelectedIndex(0);
              }}
              className="accent-primary"
            />
            Due only
          </label>

          <button
            onClick={startSession}
            disabled={due.length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-100 hover:opacity-90 disabled:opacity-35"
          >
            Start outreach ({due.length})
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-6 pb-28">
        {error ? (
          <p className="text-sm text-destructive">Could not load the queue.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <OutreachTable
            targets={visible}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onOpen={(id) => {
              window.location.href = `/?company=${id}`;
            }}
            now={now}
          />
        )}
      </main>

      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-strong bg-card">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex items-baseline gap-3 px-4 pt-3">
              <span className="font-medium">{selected.name}</span>
              <span className="tnum text-xs text-muted-foreground">
                touch {selected.touch_count + 1}
              </span>
            </div>
            <OutcomeBar
              disabled={touchMutation.isPending}
              onOutcome={(outcome, note, date) =>
                applyOutcomeAt(selectedIndex, outcome, note, date)
              }
            />
            <p className="px-4 pb-3 text-[0.6875rem] text-muted-foreground">
              j/k to move · 1, 3, 4 log directly · 2 and 5 ask for a date
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
