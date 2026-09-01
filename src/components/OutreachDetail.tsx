import { useEffect, useState } from "react";

import type { OutreachStatus, Target } from "@/lib/outreach";
import {
  type LogEntry,
  formatAbsolute,
  formatRelative,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/pipeline";

type Props = {
  target: Target;
  entries: LogEntry[];
  lastActivity: string;
  saved: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<Target>) => void;
  onAddLog: (body: string) => void;
};

const STATUSES: { value: OutreachStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "responded", label: "Responded" },
  { value: "parked", label: "Parked" },
  { value: "dead", label: "Not interested" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

export function OutreachDetail({
  target,
  entries,
  lastActivity,
  saved,
  onClose,
  onPatch,
  onAddLog,
}: Props) {
  const [log, setLog] = useState("");

  useEffect(() => {
    setLog("");
  }, [target.id]);

  const patchIfChanged = (key: keyof Target, value: unknown) => {
    if ((target[key] ?? "") === (value ?? "")) return;
    onPatch({ [key]: value } as Partial<Target>);
  };

  const numOrNull = (v: string) => {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  const submitLog = () => {
    const body = log.trim();
    if (!body) return;
    onAddLog(body);
    setLog("");
  };

  function setStatus(status: OutreachStatus) {
    if (status === "responded") {
      onPatch({ outreach_status: "responded", stage: "searching", next_touch_at: null });
    } else if (status === "dead") {
      onPatch({ outreach_status: "dead", archived: true, next_touch_at: null });
    } else {
      onPatch({ outreach_status: status });
    }
  }

  const dueOverdue = target.next_touch_at
    ? new Date(target.next_touch_at).getTime() <= Date.now()
    : false;

  return (
    <div className="panel-in-up fixed inset-0 z-40 flex flex-col overflow-y-auto bg-card">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onClose}
              className="mb-2 -ml-1 text-[0.8125rem] font-semibold text-muted-foreground uppercase transition-colors duration-100 hover:text-foreground"
            >
              ‹ Back to outreach
            </button>
            <h2 className="font-serif text-[1.75rem] leading-tight font-medium tracking-tight">
              {target.name}
            </h2>
          </div>
          <span
            className={`text-xs text-muted-foreground transition-opacity duration-100 ${
              saved ? "opacity-100" : "opacity-0"
            }`}
          >
            Saved
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[900px] px-6 pb-16">
        <div className="border-b border-border py-6">
          <Label>Outreach</Label>
          <div className="rounded-lg bg-surface p-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Industry</div>
                <input
                  key={`ind-${target.id}`}
                  defaultValue={target.industry}
                  onBlur={(e) => patchIfChanged("industry", e.target.value)}
                  className="field field-hoverable text-sm"
                />
              </div>
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Staff</div>
                <input
                  key={`emp-${target.id}`}
                  defaultValue={target.employee_count ?? ""}
                  inputMode="numeric"
                  onBlur={(e) => patchIfChanged("employee_count", numOrNull(e.target.value))}
                  className="field field-hoverable tnum text-sm"
                />
              </div>
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Last activity</div>
                <div className="tnum px-1.5 py-0.5 text-sm">{formatRelative(lastActivity)}</div>
              </div>
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Next touch</div>
                <div className="flex items-center gap-1.5">
                  <input
                    key={`next-${target.id}`}
                    type="datetime-local"
                    defaultValue={
                      target.next_touch_at ? toDatetimeLocalValue(target.next_touch_at) : ""
                    }
                    onBlur={(e) =>
                      patchIfChanged("next_touch_at", fromDatetimeLocalValue(e.target.value))
                    }
                    className={`field field-hoverable tnum text-sm ${
                      dueOverdue ? "text-destructive" : ""
                    }`}
                  />
                  {target.next_touch_at ? (
                    <button
                      type="button"
                      onClick={() => onPatch({ next_touch_at: null })}
                      className="shrink-0 text-[0.6875rem] text-muted-foreground underline underline-offset-4 transition-colors duration-100 hover:text-foreground"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-100 ${
                    target.outreach_status === s.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-border py-6">
          <Label>Contact</Label>
          <div className="rounded-lg bg-surface p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Name</div>
                <input
                  key={`cn-${target.id}`}
                  defaultValue={target.contact_name ?? ""}
                  placeholder="Name"
                  onBlur={(e) => patchIfChanged("contact_name", e.target.value || null)}
                  className="field field-hoverable text-sm"
                />
              </div>
              <div>
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Email</div>
                <input
                  key={`ce-${target.id}`}
                  defaultValue={target.contact_email ?? ""}
                  placeholder="name@company.com"
                  onBlur={(e) => patchIfChanged("contact_email", e.target.value || null)}
                  className="field field-hoverable text-sm"
                />
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-[0.6875rem] text-muted-foreground">Website</div>
                <input
                  key={`web-${target.id}`}
                  defaultValue={target.website}
                  placeholder="company.com"
                  onBlur={(e) => patchIfChanged("website", e.target.value)}
                  className="field field-hoverable text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="py-6">
          <Label>Logbook</Label>
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
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed transition-colors duration-100 focus:border-ring focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[0.6875rem] text-muted-foreground">Cmd/Ctrl + Enter to add</span>
            <button
              onClick={submitLog}
              disabled={!log.trim()}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-100 hover:opacity-90 disabled:opacity-35"
            >
              Add entry
            </button>
          </div>

          <ol className="mt-6 space-y-4">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                <div className="tnum text-[0.6875rem] text-muted-foreground">
                  {formatAbsolute(e.created_at)}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.body}</p>
              </li>
            ))}
            {entries.length === 0 ? (
              <li className="text-sm text-muted-foreground">First contact. Nothing logged yet.</li>
            ) : null}
          </ol>
        </div>
      </div>
    </div>
  );
}
