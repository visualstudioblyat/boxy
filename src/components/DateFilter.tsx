import { memo, useState, useRef, useEffect } from "react";
import { useUiStore } from "../store";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "This week", days: 7 },
  { label: "This month", days: 30 },
  { label: "All time", days: -1 },
] as const;

const SOURCES = ["all", "root", "captures"] as const;

export default memo(function DateFilter() {
  const { filter, setFilter, dateFilterOpen, setDateFilterOpen } = useUiStore();
  const ref = useRef<HTMLDivElement>(null);
  const [activePreset, setActivePreset] = useState<number>(-1);

  useEffect(() => {
    if (!dateFilterOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDateFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [dateFilterOpen, setDateFilterOpen]);

  const pickPreset = (days: number) => {
    if (days < 0) {
      setFilter((f) => ({ ...f, dateFrom: null, dateTo: null }));
      setActivePreset(-1);
    } else {
      const now = Date.now();
      const from = days === 0
        ? new Date().setHours(0, 0, 0, 0)
        : now - days * 86400000;
      setFilter((f) => ({ ...f, dateFrom: from, dateTo: now }));
      setActivePreset(days);
    }
  };

  const fmtDate = (ts: number | null) => {
    if (!ts) return "";
    return new Date(ts).toISOString().slice(0, 10);
  };

  return (
    <div className="date-filter-wrap" ref={ref}>
      <button
        className={`toolbar-btn ${filter.dateFrom ? "active" : ""}`}
        onClick={() => setDateFilterOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Date
      </button>
      {dateFilterOpen && (
        <div className="date-filter-panel">
          <div className="date-presets">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                className={`date-preset ${activePreset === p.days ? "active" : ""}`}
                onClick={() => pickPreset(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="date-range-row">
            <input
              type="date"
              className="date-input"
              value={fmtDate(filter.dateFrom)}
              onChange={(e) => {
                const v = e.target.value ? new Date(e.target.value).getTime() : null;
                setFilter((f) => ({ ...f, dateFrom: v }));
                setActivePreset(-2);
              }}
            />
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>to</span>
            <input
              type="date"
              className="date-input"
              value={fmtDate(filter.dateTo)}
              onChange={(e) => {
                const v = e.target.value ? new Date(e.target.value + "T23:59:59").getTime() : null;
                setFilter((f) => ({ ...f, dateTo: v }));
                setActivePreset(-2);
              }}
            />
          </div>
          <div className="source-filter">
            {SOURCES.map((s) => (
              <button
                key={s}
                className={`date-preset ${filter.dirSource === s ? "active" : ""}`}
                onClick={() => setFilter((f) => ({ ...f, dirSource: s }))}
              >
                {s === "all" ? "All" : s === "root" ? "Root" : "Captures"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
