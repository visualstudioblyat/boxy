import { memo, useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Clip } from "../types";
import GridCard from "./GridCard";

interface Props {
  clips: Clip[];
}

const CARD_MIN = 220;
const GAP = 14;

export default memo(function GridView({ clips }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  // measure container width for column count
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setCols(Math.max(1, Math.floor((w + GAP) / (CARD_MIN + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = Math.ceil(clips.length / cols);

  const virt = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 210,
    overscan: 3,
  });

  if (clips.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="2" width="20" height="20" rx="2" /><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
          </svg>
        </div>
        <div className="empty-text">No clips found</div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="virtual-scroll-container">
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((vRow) => (
          <div
            key={vRow.key}
            style={{
              position: "absolute",
              top: vRow.start,
              left: 0,
              right: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: GAP,
              padding: "0 20px",
            }}
          >
            {Array.from({ length: cols }, (_, ci) => {
              const idx = vRow.index * cols + ci;
              if (idx >= clips.length) return <div key={ci} />;
              return <GridCard key={clips[idx].id} clip={clips[idx]} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
