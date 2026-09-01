import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OutreachDetail } from "@/components/OutreachDetail";
import { OutreachTable } from "@/components/OutreachTable";
import {
  createLogEntry,
  fetchPipeline,
  pipelineQueryKey,
  updateCompany,
  type Company,
  type LogEntry,
} from "@/lib/pipeline";
import {
  createTarget,
  dueTargets,
  fetchOutreach,
  outreachQueryKey,
  sortQueue,
  type Target,
} from "@/lib/outreach";

export const Route = createFileRoute("/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach" },
      {
        name: "description",
        content: "The cold-outreach queue: every lead you're working, and what's due next.",
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

  // Log entries live in the pipeline query; the detail view shows the history.
  const { data: pipeline } = useQuery({
    queryKey: pipelineQueryKey,
    queryFn: fetchPipeline,
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [dueOnly, setDueOnly] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // A target becomes due through time passing, not through anything the user
  // clicks, so the view has to recompute on a timer or it goes stale.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const targets: Target[] = data ?? [];
  const queue = useMemo(() => sortQueue(targets, now), [targets, now]);
  const due = useMemo(() => dueTargets(queue, now), [queue, now]);
  const visible = dueOnly ? due : queue;

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, []);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: outreachQueryKey });
    qc.invalidateQueries({ queryKey: pipelineQueryKey });
  };

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Company> }) =>
      updateCompany(id, patch),
    onSuccess: () => {
      invalidateAll();
      flashSaved();
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createTarget(name),
    onSuccess: (target) => {
      invalidateAll();
      setOpenId(target.id);
      setAdding(false);
      setNameDraft("");
    },
  });

  const logMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => createLogEntry(id, body),
    onSuccess: () => {
      invalidateAll();
      flashSaved();
    },
  });

  const entriesFor = useCallback(
    (companyId: string): LogEntry[] =>
      (pipeline?.entries ?? [])
        .filter((e) => e.company_id === companyId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [pipeline],
  );

  const lastActivityFor = useCallback(
    (target: Target): string => {
      const entries = entriesFor(target.id);
      return entries[0]?.created_at ?? target.created_at;
    },
    [entriesFor],
  );

  function commitAdd() {
    const name = nameDraft.trim();
    if (name) createMutation.mutate(name);
    else setAdding(false);
  }

  const open = targets.find((t) => t.id === openId) ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-4">
          <h1 className="font-serif text-xl font-medium tracking-tight">Outreach</h1>
          <Link
            to="/"
            className="text-xs font-semibold text-muted-foreground uppercase transition-colors duration-100 hover:text-foreground"
          >
            Pipeline
          </Link>

          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => setDueOnly(e.target.checked)}
              className="accent-primary"
            />
            Due only
          </label>

          {adding ? (
            <input
              ref={addInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Company name"
              className="w-40 rounded-full border border-ring bg-card px-3 py-1.5 text-xs transition-colors duration-100 placeholder:text-muted-foreground focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setNameDraft("");
                  setAdding(false);
                }
              }}
              onBlur={commitAdd}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity duration-100 hover:opacity-90"
            >
              Add
            </button>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-[1200px] px-6 py-8">
        {error ? (
          <p className="text-sm text-destructive">Could not load the queue.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <OutreachTable targets={visible} onOpen={setOpenId} now={now} />
        )}
      </main>

      {open ? (
        <OutreachDetail
          target={open}
          entries={entriesFor(open.id)}
          lastActivity={lastActivityFor(open)}
          saved={saved}
          onClose={() => setOpenId(null)}
          onPatch={(patch) =>
            patchMutation.mutate({ id: open.id, patch: patch as Partial<Company> })
          }
          onAddLog={(body) => logMutation.mutate({ id: open.id, body })}
        />
      ) : null}
    </div>
  );
}
