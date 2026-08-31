import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  type Company,
  formatFollowUp,
  formatRelative,
  formatSize,
  isFollowUpOverdue,
  isStale,
} from "@/lib/pipeline";

type Props = {
  company: Company;
  lastActivity: string;
  onOpen: (id: string) => void;
  dragging?: boolean;
};

export function CardBody({
  company,
  lastActivity,
  onOpen,
  elevated,
}: Props & { elevated?: boolean }) {
  const stale = isStale(lastActivity);
  const size = formatSize(company.size_sqm_min, company.size_sqm_max);
  const followUpAt = company.follow_up_at;
  const overdue = followUpAt ? isFollowUpOverdue(followUpAt) : false;

  return (
    <button
      type="button"
      onClick={() => onOpen(company.id)}
      className={`group w-full rounded-md border border-border px-3 py-2.5 text-left transition-colors duration-100 hover:border-border-strong ${
        elevated ? "shadow-md" : "shadow-[0_1px_1px_rgba(0,0,0,0.02)]"
      } ${followUpAt ? "bg-follow-up" : "bg-card"}`}
      style={{
        borderLeftWidth: followUpAt || stale ? "2px" : undefined,
        borderLeftColor: followUpAt
          ? overdue
            ? "var(--color-follow-up-overdue)"
            : "var(--color-follow-up-foreground)"
          : stale
            ? "var(--color-warning)"
            : undefined,
      }}
    >
      <div className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em]">
        {company.name}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="tnum">{size ?? "Size TBC"}</span>
        <span className="tnum shrink-0">{formatRelative(lastActivity)}</span>
      </div>
      {followUpAt ? (
        <div
          className="tnum mt-1.5 text-[0.6875rem] font-medium uppercase tracking-wide"
          style={{
            color: overdue ? "var(--color-follow-up-overdue)" : "var(--color-follow-up-foreground)",
          }}
        >
          {overdue ? "Follow up overdue · " : "Follow up · "}
          {formatFollowUp(followUpAt)}
        </div>
      ) : null}
      {company.archived ? (
        <div className="mt-1.5 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
          Archived
        </div>
      ) : null}
    </button>
  );
}

export function CompanyCard(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.company.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <CardBody {...props} />
    </div>
  );
}
