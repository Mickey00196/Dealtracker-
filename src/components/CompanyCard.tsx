import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  type Company,
  formatRelative,
  formatSize,
  isStale,
} from "@/lib/pipeline";

type Props = {
  company: Company;
  lastActivity: string;
  onOpen: (id: string) => void;
  dragging?: boolean;
};

export function CardBody({ company, lastActivity, onOpen, elevated }: Props & { elevated?: boolean }) {
  const stale = isStale(lastActivity);
  const size = formatSize(company.size_sqm_min, company.size_sqm_max);

  return (
    <button
      type="button"
      onClick={() => onOpen(company.id)}
      className={`group w-full rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors duration-100 hover:border-border-strong ${
        elevated ? "shadow-md" : "shadow-[0_1px_1px_rgba(0,0,0,0.02)]"
      }`}
      style={
        stale
          ? { borderLeftWidth: "2px", borderLeftColor: "var(--color-warning)" }
          : undefined
      }
    >
      <div className="text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em]">
        {company.name}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="tnum">{size ?? "Size TBC"}</span>
        <span className="tnum shrink-0">{formatRelative(lastActivity)}</span>
      </div>
      {company.archived ? (
        <div className="mt-1.5 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
          Archived
        </div>
      ) : null}
    </button>
  );
}

export function CompanyCard(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.company.id });

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
