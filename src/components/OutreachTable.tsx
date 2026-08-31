import {
  dueState,
  formatDue,
  formatHeadcount,
  formatLastTouch,
  type DueState,
  type Target,
} from "@/lib/outreach";

type Props = {
  targets: Target[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Opens the mandate detail panel for this company. */
  onOpen: (id: string) => void;
  now: Date;
};

const DUE_CLASS: Record<DueState, string> = {
  overdue: "text-[var(--color-warning)]",
  today: "text-[var(--color-warning)]",
  unscheduled: "text-muted-foreground",
  scheduled: "text-muted-foreground",
};

/**
 * A table, not cards. At 200 targets the job is scanning and clearing, so
 * density beats decoration — the only colour in here marks work that is due.
 */
export function OutreachTable({ targets, selectedIndex, onSelect, onOpen, now }: Props) {
  if (targets.length === 0) {
    return (
      <p className="py-12 text-sm text-muted-foreground">
        No targets in the queue. Add companies from the board, or import a list.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border-strong text-left text-[0.6875rem] font-medium tracking-wide text-muted-foreground">
          <th className="py-2 pr-3 font-medium">Company</th>
          <th className="py-2 pr-3 font-medium">Industry</th>
          <th className="tnum py-2 pr-3 text-right font-medium">Staff</th>
          <th className="tnum py-2 pr-3 text-right font-medium">Touch</th>
          <th className="py-2 pr-3 font-medium">Last</th>
          <th className="py-2 pr-3 font-medium">Next</th>
          <th className="w-8 py-2" />
        </tr>
      </thead>
      <tbody>
        {targets.map((t, i) => {
          const state = dueState(t, now);
          const selected = i === selectedIndex;
          return (
            <tr
              key={t.id}
              onClick={() => onSelect(i)}
              className={`cursor-default border-b border-border transition-colors duration-100 ${
                selected ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <td className="py-2 pr-3">
                <span
                  className={`font-medium ${
                    state === "overdue" ? "text-[var(--color-warning)]" : ""
                  }`}
                >
                  {t.name}
                </span>
                {t.outreach_status === "parked" ? (
                  <span className="ml-2 text-[0.6875rem] text-muted-foreground">parked</span>
                ) : null}
              </td>
              <td className="py-2 pr-3 text-muted-foreground">{t.industry || "—"}</td>
              <td className="tnum py-2 pr-3 text-right text-muted-foreground">
                {formatHeadcount(t.employee_count)}
              </td>
              <td className="tnum py-2 pr-3 text-right text-muted-foreground">{t.touch_count}</td>
              <td className="tnum py-2 pr-3 text-muted-foreground">
                {formatLastTouch(t.last_touch_at, now)}
              </td>
              <td className={`tnum py-2 pr-3 ${DUE_CLASS[state]}`}>
                {formatDue(t.next_touch_at, now)}
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(t.id);
                  }}
                  title="Open details"
                  className="rounded-sm px-1.5 text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground"
                >
                  ›
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
