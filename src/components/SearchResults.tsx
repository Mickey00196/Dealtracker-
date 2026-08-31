import type { SearchHit } from "@/lib/pipeline";

export function SearchResults({
  hits,
  query,
  onOpen,
}: {
  hits: SearchHit[];
  query: string;
  onOpen: (id: string) => void;
}) {
  if (hits.length === 0) {
    return (
      <p className="py-10 text-sm text-muted-foreground">
        No matches for “{query}”. Press Escape to return to the board.
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-xs text-muted-foreground">
        {hits.length} {hits.length === 1 ? "match" : "matches"} — Escape to return to
        the board
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        {hits.map((hit, i) => (
          <li key={`${hit.company.id}-${hit.field}-${i}`}>
            <button
              onClick={() => onOpen(hit.company.id)}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors duration-100 hover:bg-muted"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-[-0.01em]">
                  {hit.company.name}
                </span>
                <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  {hit.field}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {hit.snippet.slice(0, hit.matchStart)}
                <mark className="bg-highlight text-foreground">
                  {hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength)}
                </mark>
                {hit.snippet.slice(hit.matchStart + hit.matchLength)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
