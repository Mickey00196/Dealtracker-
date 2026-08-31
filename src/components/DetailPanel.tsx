import { useEffect, useRef, useState } from "react";

import {
  STAGES,
  STAGE_LABEL,
  type Company,
  type LogEntry,
  type Stage,
  formatAbsolute,
  indicativeRentLine,
  nf,
} from "@/lib/pipeline";

type Props = {
  company: Company | null; // null = create mode
  entries: LogEntry[];
  saved: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<Company>) => void;
  onCreate: (name: string) => void;
  onAddLog: (body: string) => void;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export function DetailPanel({
  company,
  entries,
  saved,
  onClose,
  onPatch,
  onCreate,
  onAddLog,
}: Props) {
  const [draftName, setDraftName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState("");

  const creating = company === null;

  useEffect(() => {
    setLog("");
    setDraftName(company?.name ?? "");
    if (creating) nameRef.current?.focus();
  }, [company?.id, creating]);

  const patchIfChanged = (key: keyof Company, value: unknown) => {
    if (!company) return;
    if ((company[key] ?? "") === (value ?? "")) return;
    onPatch({ [key]: value } as Partial<Company>);
  };

  const numOrNull = (v: string) => {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  const indicative = company
    ? indicativeRentLine(
        company.target_rent_per_sqm,
        company.size_sqm_min,
        company.size_sqm_max,
        company.budget_per_year,
      )
    : null;

  const submitLog = () => {
    const body = log.trim();
    if (!body || !company) return;
    onAddLog(body);
    setLog("");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/5"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={creating ? "New company" : company.name}
        className="panel-in fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border-strong bg-card"
      >
        {/* header */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <input
              ref={nameRef}
              value={draftName}
              placeholder="Company name"
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                if (creating) {
                  if (draftName.trim()) onCreate(draftName.trim());
                } else if (draftName.trim()) {
                  patchIfChanged("name", draftName.trim());
                } else {
                  setDraftName(company.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="field field-hoverable text-lg font-semibold tracking-[-0.015em]"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span
              className={`text-xs text-muted-foreground transition-opacity duration-100 ${
                saved ? "opacity-100" : "opacity-0"
              }`}
            >
              Saved
            </span>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-sm px-1.5 text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {creating ? (
          <div className="px-5 py-5 text-sm text-muted-foreground">
            Enter a company name to create the mandate. The requirement brief and
            logbook open once it exists.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* stage + contact */}
            <div className="border-b border-border px-5 py-4">
              <Label>Stage</Label>
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => patchIfChanged("stage", s)}
                    className={`rounded-sm border px-2.5 py-1 text-xs transition-colors duration-100 ${
                      company.stage === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {STAGE_LABEL[s as Stage]}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact</Label>
                  <input
                    defaultValue={company.contact_name ?? ""}
                    key={`cn-${company.id}`}
                    placeholder="Name"
                    onBlur={(e) => patchIfChanged("contact_name", e.target.value || null)}
                    className="field field-hoverable text-sm"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <input
                    defaultValue={company.contact_email ?? ""}
                    key={`ce-${company.id}`}
                    placeholder="name@company.com"
                    onBlur={(e) => patchIfChanged("contact_email", e.target.value || null)}
                    className="field field-hoverable text-sm"
                  />
                </div>
              </div>
            </div>

            {/* requirement brief */}
            <div className="border-b border-border px-5 py-4">
              <h3 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wide">
                Requirement brief
              </h3>
              <Label>Space</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Size min (m²)</Label>
                  <input
                    key={`min-${company.id}`}
                    defaultValue={company.size_sqm_min ?? ""}
                    inputMode="numeric"
                    onBlur={(e) => patchIfChanged("size_sqm_min", numOrNull(e.target.value))}
                    className="field field-hoverable tnum text-sm"
                  />
                </div>
                <div>
                  <Label>Size max (m²)</Label>
                  <input
                    key={`max-${company.id}`}
                    defaultValue={company.size_sqm_max ?? ""}
                    inputMode="numeric"
                    onBlur={(e) => patchIfChanged("size_sqm_max", numOrNull(e.target.value))}
                    className="field field-hoverable tnum text-sm"
                  />
                </div>
                <div>
                  <Label>Preferred areas</Label>
                  <input
                    key={`pa-${company.id}`}
                    defaultValue={company.preferred_areas}
                    onBlur={(e) => patchIfChanged("preferred_areas", e.target.value)}
                    className="field field-hoverable text-sm"
                  />
                </div>
                <div>
                  <Label>Target move date</Label>
                  <input
                    key={`tm-${company.id}`}
                    type="date"
                    defaultValue={company.target_move_date ?? ""}
                    onBlur={(e) =>
                      patchIfChanged("target_move_date", e.target.value || null)
                    }
                    className="field field-hoverable tnum text-sm"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label>Budget</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Budget per year (€)</Label>
                    <input
                      key={`by-${company.id}`}
                      defaultValue={
                        company.budget_per_year != null ? nf.format(company.budget_per_year) : ""
                      }
                      inputMode="numeric"
                      onBlur={(e) => {
                        const v = numOrNull(e.target.value);
                        e.target.value = v != null ? nf.format(v) : "";
                        patchIfChanged("budget_per_year", v);
                      }}
                      className="field field-hoverable tnum text-sm"
                    />
                  </div>
                  <div>
                    <Label>Target rent (€/m²/year)</Label>
                    <input
                      key={`tr-${company.id}`}
                      defaultValue={
                        company.target_rent_per_sqm != null
                          ? nf.format(company.target_rent_per_sqm)
                          : ""
                      }
                      inputMode="numeric"
                      onBlur={(e) => {
                        const v = numOrNull(e.target.value);
                        e.target.value = v != null ? nf.format(v) : "";
                        patchIfChanged("target_rent_per_sqm", v);
                      }}
                      className="field field-hoverable tnum text-sm"
                    />
                  </div>
                </div>
                {indicative ? (
                  <p className="tnum mt-2 text-[0.6875rem] text-muted-foreground">
                    {indicative.text}
                    {indicative.overBudget ? (
                      <span style={{ color: "var(--color-warning)" }}> over budget</span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <Label>Office requirements</Label>
                <textarea
                  key={`or-${company.id}`}
                  defaultValue={company.office_requirements}
                  rows={5}
                  placeholder="Meeting rooms, workstations, fit-out level, parking, bike storage, HVAC…"
                  onBlur={(e) => patchIfChanged("office_requirements", e.target.value)}
                  className="field field-hoverable resize-y text-sm leading-relaxed"
                />
              </div>

              <div className="mt-3">
                <Label>Background</Label>
                <textarea
                  key={`nt-${company.id}`}
                  defaultValue={company.notes}
                  rows={4}
                  onBlur={(e) => patchIfChanged("notes", e.target.value)}
                  className="field field-hoverable resize-y text-sm leading-relaxed"
                />
              </div>
            </div>


            {/* logbook */}
            <div className="px-5 py-4">
              <h3 className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wide">
                Logbook
              </h3>
              <textarea
                value={log}
                rows={3}
                placeholder="What happened?"
                onChange={(e) => setLog(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    submitLog();
                  }
                }}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed transition-colors duration-100 focus:border-ring focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[0.6875rem] text-muted-foreground">
                  Cmd/Ctrl + Enter to add
                </span>
                <button
                  onClick={submitLog}
                  disabled={!log.trim()}
                  className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-100 hover:opacity-90 disabled:opacity-35"
                >
                  Add entry
                </button>
              </div>

              <ol className="mt-5 space-y-4">
                {entries.map((e) => (
                  <li key={e.id} className="border-l border-border pl-3">
                    <div className="tnum text-[0.6875rem] text-muted-foreground">
                      {formatAbsolute(e.created_at)}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {e.body}
                    </p>
                  </li>
                ))}
                {entries.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No entries yet.</li>
                ) : null}
              </ol>
            </div>

            {/* archive */}
            <div className="border-t border-border px-5 py-4">
              <button
                onClick={() => onPatch({ archived: !company.archived })}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-100 hover:text-foreground"
              >
                {company.archived ? "Restore to board" : "Archive mandate"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
