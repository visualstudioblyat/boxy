import { memo, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Clip } from "../types";
import TimelineDay from "./TimelineDay";

interface Props {
  clips: Clip[];
}

// group clips by date
const groupByDate = (clips: Clip[]) => {
  const groups = new Map<string, Clip[]>();
  for (const clip of clips) {
    const d = new Date(clip.recordedAt * 1000);
    const key = d.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(clip);
    groups.set(key, arr);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};

export default memo(function TimelineView({ clips }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByDate(clips), [clips]);

  // estimate height per day group: header + clip rows
  const estimateSize = useCallback((i: number) => {
    const clipCount = groups[i][1].length;
    const cols = 3; // rough estimate for 180px min cards
    const rows = Math.ceil(clipCount / cols);
    return 50 + rows * 150;
  }, [groups]);

  const virt = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 2,
  });

  if (clips.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </div>
        <div className="empty-text">No clips found</div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="virtual-scroll-container">
      <div style={{ height: virt.getTotalSize(), position: "relative", paddingLeft: 24 }}>
        <div className="timeline-line" />
        {virt.getVirtualItems().map((vRow) => {
          const [date, dayClips] = groups[vRow.index];
          return (
            <div
              key={vRow.key}
              ref={virt.measureElement}
              data-index={vRow.index}
              style={{
                position: "absolute",
                top: vRow.start,
                left: 0,
                right: 0,
                paddingLeft: 24,
              }}
            >
              <TimelineDay date={date} clips={dayClips} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
