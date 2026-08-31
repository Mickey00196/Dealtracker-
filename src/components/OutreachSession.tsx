import { useEffect } from "react";

import { OutcomeBar } from "./OutcomeBar";
import { formatAbsolute, type LogEntry } from "@/lib/pipeline";
import {
  OUTCOMES,
  formatHeadcount,
  formatLastTouch,
  type Target,
  type TouchOutcome,
} from "@/lib/outreach";

type Props = {
  target: Target;
  entries: LogEntry[];
  position: number;
  total: number;
  onOutcome: (outcome: TouchOutcome, note: string, date?: string) => void;
  onSkip: () => void;
  onExit: () => void;
};

/**
 * Session mode commits you to a block of outreach rather than dipping in and
 * out. One company fills the screen, the outcome keys advance automatically,
 * and there is nothing else to look at.
 */
export function OutreachSession({
  target,
  entries,
  position,
  total,
  onOutcome,
  onSkip,
  onExit,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (typing) return;

      const match = OUTCOMES.find((o) => o.key === e.key);
      if (match && !match.needsDate) {
        e.preventDefault();
        onOutcome(match.outcome, "");
      } else if (e.key === "s") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOutcome, onSkip, onExit]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="tnum text-xs text-muted-foreground">
          {position} of {total}
        </span>
        <button
          onClick={onExit}
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-100 hover:text-foreground"
        >
          Exit session (Esc)
        </button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">{target.name}</h2>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {target.industry ? <span>{target.industry}</span> : null}
          <span className="tnum">{formatHeadcount(target.employee_count)} staff</span>
          <span className="tnum">
            Touch {target.touch_count + 1} · last {formatLastTouch(target.last_touch_at)}
          </span>
        </div>

        {target.contact_name || target.contact_email ? (
          <p className="mt-3 text-sm">
            {target.contact_name}
            {target.contact_email ? (
              <>
                {target.contact_name ? " · " : ""}
                <a href={`mailto:${target.contact_email}`} className="underline underline-offset-4">
                  {target.contact_email}
                </a>
              </>
            ) : null}
          </p>
        ) : null}

        {target.website ? (
          <p className="mt-1 text-sm">
            <a
              href={target.website}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground underline underline-offset-4"
            >
              {target.website}
            </a>
          </p>
        ) : null}

        <h3 className="mt-8 mb-3 text-[0.8125rem] font-semibold tracking-wide">History</h3>
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-l border-border pl-3">
              <div className="tnum text-[0.6875rem] text-muted-foreground">
                {formatAbsolute(e.created_at)}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{e.body}</p>
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="text-sm text-muted-foreground">First contact. Nothing logged yet.</li>
          ) : null}
        </ol>
      </div>

      <div className="mx-auto w-full max-w-2xl px-2">
        <OutcomeBar onOutcome={onOutcome} />
        <p className="px-4 pb-4 text-[0.6875rem] text-muted-foreground">
          Press 1–5 to log an outcome, s to skip, Esc to exit.
        </p>
      </div>
    </div>
  );
}
