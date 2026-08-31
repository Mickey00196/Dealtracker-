import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";

import { CardBody, CompanyCard } from "./CompanyCard";
import {
  STAGES,
  STAGE_COLOR_VAR,
  STAGE_LABEL,
  byFollowUpThenActivity,
  type Company,
  type Stage,
} from "@/lib/pipeline";

type Props = {
  companies: Company[];
  lastActivity: Record<string, string>;
  onOpen: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onQuickCreate: (name: string, stage: Stage) => void;
};

function QuickAdd({
  stage,
  onQuickCreate,
}: {
  stage: Stage;
  onQuickCreate: (name: string, stage: Stage) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function commit(keepOpen: boolean) {
    const name = value.trim();
    if (name) onQuickCreate(name, stage);
    setValue("");
    if (keepOpen) inputRef.current?.focus();
    else setAdding(false);
  }

  if (adding) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Company name"
        className="w-full rounded-md border border-ring bg-card px-2.5 py-2 text-sm transition-colors duration-100 placeholder:text-muted-foreground focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue("");
            setAdding(false);
          }
        }}
        onBlur={() => commit(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="group flex min-h-16 flex-1 items-start justify-start rounded-md border border-dashed border-transparent px-2.5 py-2 text-left text-xs text-transparent transition-colors duration-100 hover:border-border-strong hover:text-muted-foreground"
    >
      Add company to {STAGE_LABEL[stage]}
    </button>
  );
}

function Column({
  stage,
  companies,
  lastActivity,
  onOpen,
  onQuickCreate,
}: {
  stage: Stage;
  companies: Company[];
  lastActivity: Record<string, string>;
  onOpen: (id: string) => void;
  onQuickCreate: (name: string, stage: Stage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}` });

  return (
    <section className="flex min-w-0 flex-col">
      <header className="flex items-baseline gap-2 border-b border-border-strong pb-2">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: STAGE_COLOR_VAR[stage] }}
        />
        <h2 className="text-[0.8125rem] font-semibold tracking-wide uppercase">
          {STAGE_LABEL[stage]}
        </h2>
        <span className="tnum ml-auto text-xs text-muted-foreground">{companies.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={`mt-2 flex min-h-40 flex-col gap-2 rounded-md p-1 transition-colors duration-100 ${
          isOver ? "bg-accent/60" : ""
        }`}
      >
        <SortableContext items={companies.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              lastActivity={lastActivity[c.id] ?? c.created_at}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
        <QuickAdd stage={stage} onQuickCreate={onQuickCreate} />
      </div>
    </section>
  );
}

export function Board({ companies, lastActivity, onOpen, onStageChange, onQuickCreate }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const byStage = (stage: Stage) =>
    companies.filter((c) => c.stage === stage).sort(byFollowUpThenActivity(lastActivity));

  const active = companies.find((c) => c.id === activeId) ?? null;

  function handleStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active: a, over } = event;
    if (!over) return;
    const overId = String(over.id);
    const target: string | undefined = overId.startsWith("col:")
      ? overId.slice(4)
      : companies.find((c) => c.id === overId)?.stage;
    if (!target) return;
    const company = companies.find((c) => c.id === String(a.id));
    if (!company || company.stage === target) return;
    onStageChange(company.id, target as Stage);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-x-5 gap-y-7 md:grid-cols-2 md:divide-x md:divide-border xl:grid-cols-5">
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-0 xl:px-2 xl:first:pl-0 xl:last:pr-0">
            <Column
              stage={stage}
              companies={byStage(stage)}
              lastActivity={lastActivity}
              onOpen={onOpen}
              onQuickCreate={onQuickCreate}
            />
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 120, easing: "ease" }}>
        {active ? (
          <div className="rotate-[0.4deg]">
            <CardBody
              company={active}
              lastActivity={lastActivity[active.id] ?? active.created_at}
              onOpen={() => {}}
              elevated
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
