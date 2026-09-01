import { dueState, formatDue, type DueState, type Target } from "@/lib/outreach";

type Props = {
  targets: Target[];
  onOpen: (id: string) => void;
  now: Date;
};

const DUE_CLASS: Record<DueState, string> = {
  overdue: "text-destructive font-medium",
  today: "text-warning font-medium",
  unscheduled: "text-destructive font-medium",
  scheduled: "text-muted-foreground",
};

const DOT_CLASS: Record<DueState, string> = {
  overdue: "bg-destructive",
  today: "bg-warning",
  unscheduled: "bg-destructive",
  scheduled: "bg-muted-foreground/40",
};

/**
 * Company and due date, nothing else — the rest (industry, staff, touch
 * history) lives one click away. At scale the job is scanning and clearing.
 */
export function OutreachTable({ targets, onOpen, now }: Props) {
  if (targets.length === 0) {
    return (
      <p className="py-12 text-sm text-muted-foreground">
        No targets in the queue. Add a company to get started.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
          <th className="border-b border-border-strong py-3 pr-3 font-semibold">Company</th>
          <th className="border-b border-border-strong py-3 pr-3 text-right font-semibold">Due</th>
          <th className="w-6 border-b border-border-strong py-3" />
        </tr>
      </thead>
      <tbody>
        {targets.map((t) => {
          const state = dueState(t, now);
          return (
            <tr
              key={t.id}
              onClick={() => onOpen(t.id)}
              className="group cursor-pointer border-b border-border last:border-b-0"
            >
              <td className="rounded-l-lg py-4 pr-3 transition-colors duration-100 group-hover:bg-muted">
                <span
                  className={`text-[0.9375rem] font-medium ${
                    state === "overdue" || state === "unscheduled"
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {t.name}
                </span>
                {t.outreach_status === "parked" ? (
                  <span className="ml-2 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    · parked
                  </span>
                ) : null}
              </td>
              <td className="py-4 pr-3 text-right transition-colors duration-100 group-hover:bg-muted">
                <span
                  className={`tnum inline-flex items-center gap-2 text-[0.8125rem] ${DUE_CLASS[state]}`}
                >
                  <span aria-hidden className={`size-1.5 rounded-full ${DOT_CLASS[state]}`} />
                  {formatDue(t.next_touch_at, now)}
                </span>
              </td>
              <td className="rounded-r-lg py-4 text-right font-light text-muted-foreground transition-all duration-100 group-hover:translate-x-0.5 group-hover:bg-muted group-hover:text-foreground">
                ›
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
