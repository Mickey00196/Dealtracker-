import { useEffect, useRef, useState } from "react";

import { OUTCOMES, type TouchOutcome } from "@/lib/outreach";

type Props = {
  /** Called with the outcome, an optional note, and an optional ISO date. */
  onOutcome: (outcome: TouchOutcome, note: string, date?: string) => void;
  disabled?: boolean;
};

/**
 * The outcome bar is the whole point of the queue: one keystroke logs the
 * touch and schedules the next one. Keys 1-5 are handled by the parent view
 * so they work without focusing anything; this component owns the buttons,
 * the note field, and the date prompt for outcomes that need one.
 */
export function OutcomeBar({ onOutcome, disabled }: Props) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<TouchOutcome | null>(null);
  const [date, setDate] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending) dateRef.current?.focus();
  }, [pending]);

  function choose(outcome: TouchOutcome) {
    const def = OUTCOMES.find((o) => o.outcome === outcome);
    if (def?.needsDate) {
      setPending(outcome);
      return;
    }
    onOutcome(outcome, note);
    setNote("");
  }

  function confirmDate() {
    if (!pending || !date) return;
    onOutcome(pending, note, new Date(`${date}T09:00:00`).toISOString());
    setPending(null);
    setDate("");
    setNote("");
  }

  if (pending) {
    const def = OUTCOMES.find((o) => o.outcome === pending);
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <span className="text-sm">{def?.label} — pick a date</span>
        <input
          ref={dateRef}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmDate();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setPending(null);
              setDate("");
            }
          }}
          className="tnum rounded-sm border border-input bg-card px-2 py-1 text-sm focus:border-ring focus:outline-none"
        />
        <button
          onClick={confirmDate}
          disabled={!date}
          className="rounded-sm bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-35"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            setPending(null);
            setDate("");
          }}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
      {OUTCOMES.map((o) => (
        <button
          key={o.outcome}
          onClick={() => choose(o.outcome)}
          disabled={disabled}
          title={o.hint}
          className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs transition-colors duration-100 hover:bg-muted disabled:opacity-35"
        >
          <kbd className="tnum rounded-sm bg-muted px-1 text-[0.625rem] text-muted-foreground">
            {o.key}
          </kbd>
          {o.label}
        </button>
      ))}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        disabled={disabled}
        className="min-w-40 flex-1 rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
    </div>
  );
}
