import { memo } from "react";
import { useUiStore } from "../store";
import { localUrl, fmtDuration } from "../utils";
import { DIR_SOURCE_COLORS, DIR_SOURCE_FALLBACK_COLORS } from "../constants";
import type { Clip } from "../types";

const getSourceColor = (source: string) => {
  const key = source.toLowerCase();
  if (key in DIR_SOURCE_COLORS) return DIR_SOURCE_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return DIR_SOURCE_FALLBACK_COLORS[Math.abs(h) % DIR_SOURCE_FALLBACK_COLORS.length];
};

const fmtDateLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};

const fmtTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

interface Props {
  date: string;
  clips: Clip[];
}

export default memo(function TimelineDay({ date, clips }: Props) {
  const setPreviewClipId = useUiStore((s) => s.setPreviewClipId);
  const setDetailClipId = useUiStore((s) => s.setDetailClipId);
  const setSelectedClipId = useUiStore((s) => s.setSelectedClipId);

  return (
    <div className="timeline-day">
      <div className="timeline-date">
        {fmtDateLabel(date)}
        <span className="timeline-count">{clips.length} clip{clips.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="timeline-clips">
        {clips.map((clip) => {
          const thumbSrc = clip.thumbPath ? localUrl(clip.thumbPath) : null;
          const dur = fmtDuration(clip.durationSecs);
          return (
            <div
              key={clip.id}
              className="timeline-clip"
              onClick={() => { setSelectedClipId(clip.id); setDetailClipId(clip.id); }}
              onDoubleClick={() => setPreviewClipId(clip.id)}
            >
              {thumbSrc ? (
                <img className="timeline-clip-thumb" src={thumbSrc} loading="lazy" alt="" />
              ) : (
                <div className="grid-thumb-placeholder" style={{ aspectRatio: "16/9" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </div>
              )}
              {dur && <span className="timeline-clip-duration">{dur}</span>}
              <div className="timeline-clip-time">{fmtTime(clip.recordedAt)}</div>
              <div className="grid-source-indicator" style={{ background: getSourceColor(clip.dirSource) }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
