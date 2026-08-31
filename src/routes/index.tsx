import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "@/components/Board";
import { DetailPanel } from "@/components/DetailPanel";
import { SearchResults } from "@/components/SearchResults";
import {
  type Company,
  type PipelineData,
  type Stage,
  createCompany,
  createLogEntry,
  fetchPipeline,
  lastActivityMap,
  pipelineQueryKey,
  searchPipeline,
  updateCompany,
} from "@/lib/pipeline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pipeline — Tenant Rep Mandate Tracker" },
      {
        name: "description",
        content:
          "A calm board for tracking office space mandates by stage, with a timestamped, append-only logbook per company.",
      },
      { property: "og:title", content: "Pipeline — Tenant Rep Mandate Tracker" },
      {
        property: "og:description",
        content:
          "Track office space mandates by stage with requirement briefs and an append-only logbook.",
      },
    ],
  }),
  component: PipelinePage,
});

const NEW = "__new__";

function PipelinePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: pipelineQueryKey,
    queryFn: fetchPipeline,
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [saved, setSaved] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 200);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, []);

  const patchLocal = (id: string, patch: Partial<Company>) =>
    qc.setQueryData<PipelineData>(pipelineQueryKey, (prev) =>
      prev
        ? {
            ...prev,
            companies: prev.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          }
        : prev,
    );

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Company> }) =>
      updateCompany(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: pipelineQueryKey });
      const snapshot = qc.getQueryData<PipelineData>(pipelineQueryKey);
      patchLocal(id, patch);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(pipelineQueryKey, ctx.snapshot);
    },
    onSuccess: flashSaved,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createCompany({ name }),
    onSuccess: (company) => {
      qc.setQueryData<PipelineData>(pipelineQueryKey, (prev) =>
        prev ? { ...prev, companies: [company, ...prev.companies] } : prev,
      );
      setOpenId(company.id);
      flashSaved();
    },
  });

  const quickCreateMutation = useMutation({
    mutationFn: ({ name, stage }: { name: string; stage: Stage }) => createCompany({ name, stage }),
    onMutate: async ({ name, stage }) => {
      await qc.cancelQueries({ queryKey: pipelineQueryKey });
      const snapshot = qc.getQueryData<PipelineData>(pipelineQueryKey);
      const now = new Date().toISOString();
      const tempId = `temp-${now}-${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        id: tempId,
        name,
        stage,
        size_sqm_min: null,
        size_sqm_max: null,
        preferred_areas: "",
        target_move_date: null,
        notes: "",
        contact_name: null,
        contact_email: null,
        follow_up_at: null,
        archived: false,
        created_at: now,
        updated_at: now,
      } as Company;
      qc.setQueryData<PipelineData>(pipelineQueryKey, (prev) =>
        prev ? { ...prev, companies: [optimistic, ...prev.companies] } : prev,
      );
      return { snapshot, tempId };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(pipelineQueryKey, ctx.snapshot);
    },
    onSuccess: (company, _v, ctx) => {
      qc.setQueryData<PipelineData>(pipelineQueryKey, (prev) =>
        prev
          ? {
              ...prev,
              companies: prev.companies.map((c) => (c.id === ctx?.tempId ? company : c)),
            }
          : prev,
      );
      flashSaved();
    },
  });

  const logMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => createLogEntry(id, body),
    onSuccess: (entry) => {
      qc.setQueryData<PipelineData>(pipelineQueryKey, (prev) =>
        prev ? { ...prev, entries: [entry, ...prev.entries] } : prev,
      );
      flashSaved();
    },
  });

  const pipeline: PipelineData = data ?? { companies: [], entries: [] };
  const lastActivity = useMemo(() => lastActivityMap(pipeline), [pipeline]);
  const searching = query.trim().length > 0;
  const hits = useMemo(
    () => (searching ? searchPipeline(pipeline, query) : []),
    [pipeline, query, searching],
  );

  const boardCompanies = pipeline.companies.filter((c) => (showArchived ? true : !c.archived));

  const openCompany =
    openId && openId !== NEW ? (pipeline.companies.find((c) => c.id === openId) ?? null) : null;
  const panelOpen = openId !== null;
  const openEntries = openCompany
    ? pipeline.entries
        .filter((e) => e.company_id === openCompany.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape") {
        if (panelOpen) setOpenId(null);
        else if (rawQuery) {
          setRawQuery("");
          setQuery("");
          searchRef.current?.blur();
        }
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setOpenId(NEW);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, rawQuery]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-5 py-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.08em]">Pipeline</h1>
          <div className="relative min-w-52 flex-1">
            <input
              ref={searchRef}
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search companies, notes, areas, contacts, log entries…"
              className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm transition-colors duration-100 placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
            {!rawQuery ? (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-border px-1.5 text-[0.6875rem] text-muted-foreground">
                /
              </kbd>
            ) : null}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-primary"
            />
            Show archived
          </label>
          <button
            onClick={() => setOpenId(NEW)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-100 hover:opacity-90"
          >
            New company
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6">
        {error ? (
          <p className="text-sm text-destructive">Could not load the pipeline.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : searching ? (
          <SearchResults hits={hits} query={query} onOpen={setOpenId} />
        ) : boardCompanies.length === 0 ? (
          <div className="max-w-md py-16">
            <h2 className="text-lg font-semibold tracking-[-0.015em]">Your pipeline is empty</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Each company is one mandate. Move it across the five stages as the search progresses,
              keep the requirement brief up to date, and log every call and viewing. Cards untouched
              for two weeks are flagged.
            </p>
            <button
              onClick={() => setOpenId(NEW)}
              className="mt-5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-100 hover:opacity-90"
            >
              New company
            </button>
          </div>
        ) : (
          <Board
            companies={boardCompanies}
            lastActivity={lastActivity}
            onOpen={setOpenId}
            onStageChange={(id, stage: Stage) => patchMutation.mutate({ id, patch: { stage } })}
            onQuickCreate={(name, stage) => quickCreateMutation.mutate({ name, stage })}
          />
        )}
      </main>

      {panelOpen ? (
        <DetailPanel
          company={openCompany}
          entries={openEntries}
          saved={saved}
          onClose={() => setOpenId(null)}
          onPatch={(patch) => openCompany && patchMutation.mutate({ id: openCompany.id, patch })}
          onCreate={(name) => createMutation.mutate(name)}
          onAddLog={(body) => openCompany && logMutation.mutate({ id: openCompany.id, body })}
        />
      ) : null}
    </div>
  );
}
