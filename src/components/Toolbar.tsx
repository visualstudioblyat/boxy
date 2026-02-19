import { memo, useState, useRef, useEffect } from "react";
import { useUiStore, useClipStore, useSearchStore } from "../store";
import { SORT_OPTIONS } from "../constants";
import type { SortField, SortDir } from "../types";
import DateFilter from "./DateFilter";
import BulkBar from "./BulkBar";

export default memo(function Toolbar() {
  const selectedClipIds = useUiStore((s) => s.selectedClipIds);

  // render bulk bar when multi-select active
  if (selectedClipIds.size > 0) return <BulkBar />;

  return <NormalToolbar />;
});

const NormalToolbar = memo(function NormalToolbar() {
  const { viewMode, setViewMode, sort, setSort, filter, setFilter, sidebarOpen, setSidebarOpen } = useUiStore();
  const clips = useClipStore((s) => s.clips);
  const { query, setQuery, semanticMode, setSemanticMode } = useSearchStore();
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const close = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sortOpen]);

  const handleSort = (field: SortField) => {
    const dir: SortDir = sort.field === field && sort.dir === "desc" ? "asc" : "desc";
    setSort({ field, dir });
    setSortOpen(false);
  };

  const hasFilters = filter.dateFrom || filter.dateTo || filter.tags.length > 0 || filter.dirSource !== "all" || filter.starred !== null;

  return (
    <div className="toolbar">
      {/* sidebar toggle */}
      <button
        className={`toolbar-btn ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle sidebar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      <div className="search-wrap">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          className="search-input"
          placeholder={semanticMode ? "Semantic search..." : "Search clips..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <button
        className={`semantic-toggle ${semanticMode ? "active" : ""}`}
        onClick={() => setSemanticMode(!semanticMode)}
        title="Toggle semantic search"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V12h3a3 3 0 013 3v1" />
          <path d="M8 9.5A4 4 0 016 6a4 4 0 018 0" />
          <circle cx="12" cy="19" r="3" />
        </svg>
        AI
      </button>

      <div className="toolbar-divider" />

      {/* star filter */}
      <button
        className={`toolbar-btn ${filter.starred === true ? "active" : ""}`}
        onClick={() => setFilter((f) => ({ ...f, starred: f.starred === true ? null : true }))}
        title="Show starred only"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={filter.starred === true ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* view toggle */}
      <button
        className={`toolbar-btn ${viewMode === "grid" ? "active" : ""}`}
        onClick={() => setViewMode("grid")}
        title="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${viewMode === "timeline" ? "active" : ""}`}
        onClick={() => setViewMode("timeline")}
        title="Timeline view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* sort */}
      <div className="sort-dropdown" ref={sortRef}>
        <button className="toolbar-btn" onClick={() => setSortOpen(!sortOpen)}>
          Sort: {SORT_OPTIONS.find((o) => o.field === sort.field)?.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {sort.dir === "desc"
              ? <path d="M12 5v14M5 12l7 7 7-7" />
              : <path d="M12 19V5M5 12l7-7 7 7" />
            }
          </svg>
        </button>
        {sortOpen && (
          <div className="sort-menu">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.field}
                className={`sort-item ${sort.field === o.field ? "active" : ""}`}
                onClick={() => handleSort(o.field)}
              >
                {o.label}
                {sort.field === o.field && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    {sort.dir === "desc" ? <path d="M12 5v14M5 12l7 7 7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* date filter */}
      <DateFilter />

      {hasFilters && (
        <button
          className="toolbar-btn"
          onClick={() => useUiStore.getState().setFilter({
            dateFrom: null, dateTo: null, tags: [], search: "", dirSource: "all", starred: null,
          })}
          style={{ color: "var(--danger)" }}
        >
          Clear
        </button>
      )}

      <span className="toolbar-count">{clips.length} clips</span>
    </div>
  );
});
