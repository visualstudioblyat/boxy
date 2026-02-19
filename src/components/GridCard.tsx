import { memo, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore, useClipStore, useTagStore } from "../store";
import { localUrl, fmtDuration, fmtDate, fmtSize } from "../utils";
import { DIR_SOURCE_COLORS, DIR_SOURCE_FALLBACK_COLORS } from "../constants";
import FilmstripPreview from "./FilmstripPreview";
import type { Clip } from "../types";

interface Props {
  clip: Clip;
}

const getSourceColor = (source: string) => {
  const key = source.toLowerCase();
  if (key in DIR_SOURCE_COLORS) return DIR_SOURCE_COLORS[key];
  // hash to a fallback color
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return DIR_SOURCE_FALLBACK_COLORS[Math.abs(h) % DIR_SOURCE_FALLBACK_COLORS.length];
};

export default memo(function GridCard({ clip }: Props) {
  const selectedClipId = useUiStore((s) => s.selectedClipId);
  const selectedClipIds = useUiStore((s) => s.selectedClipIds);
  const setSelectedClipId = useUiStore((s) => s.setSelectedClipId);
  const setPreviewClipId = useUiStore((s) => s.setPreviewClipId);
  const setDetailClipId = useUiStore((s) => s.setDetailClipId);
  const toggleClipSelection = useUiStore((s) => s.toggleClipSelection);
  const updateClip = useClipStore((s) => s.updateClip);
  const tags = useTagStore((s) => s.tags);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [mouseXRatio, setMouseXRatio] = useState(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const thumbRef = useRef<HTMLDivElement>(null);

  const selected = selectedClipId === clip.id;
  const multiSelected = selectedClipIds.has(clip.id);
  const thumbSrc = clip.thumbPath ? localUrl(clip.thumbPath) : null;
  const clipTags = tags.filter((t) => clip.tags.includes(t.id));
  const dur = fmtDuration(clip.durationSecs);
  const sourceColor = getSourceColor(clip.dirSource);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleClipSelection(clip.id);
      return;
    }
    setSelectedClipId(clip.id);
    setDetailClipId(clip.id);
  };

  const handleDblClick = () => setPreviewClipId(clip.id);
  const handleCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const handleThumbEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);
  const handleThumbLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
  }, []);
  const handleThumbMove = useCallback((e: React.MouseEvent) => {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();
    setMouseXRatio(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }, []);

  const toggleStar = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !clip.starred;
    updateClip(clip.id, { starred: next });
    try { await invoke("toggle_star", { clipId: clip.id, starred: next }); }
    catch { updateClip(clip.id, { starred: !next }); }
  }, [clip.id, clip.starred, updateClip]);

  return (
    <>
      <div
        className={`grid-card ${selected ? "selected" : ""} ${multiSelected ? "selected-multi" : ""}`}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        onContextMenu={handleCtx}
      >
        <div
          ref={thumbRef}
          className="grid-thumb-wrap"
          onMouseEnter={handleThumbEnter}
          onMouseLeave={handleThumbLeave}
          onMouseMove={handleThumbMove}
        >
          {thumbSrc ? (
            <img className="grid-thumb" src={thumbSrc} loading="lazy" alt="" />
          ) : (
            <div className="grid-thumb-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          )}
          {clip.durationSecs && (
            <FilmstripPreview videoPath={clip.path} visible={hovered} mouseX={mouseXRatio} />
          )}
        </div>

        {/* star button */}
        <button
          className={`star-btn ${clip.starred ? "starred" : ""}`}
          onClick={toggleStar}
          title={clip.starred ? "Unstar" : "Star"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={clip.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>

        {dur && <span className="grid-duration">{dur}</span>}
        <div className="grid-info">
          <div className="grid-filename" title={clip.filename}>{clip.filename}</div>
          <div className="grid-date">{fmtDate(clip.recordedAt)} · {fmtSize(clip.fileSize)}</div>
        </div>
        {clipTags.length > 0 && (
          <div className="grid-tags">
            {clipTags.map((t) => (
              <span key={t.id} className="tag-badge">
                <span className="tag-dot" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* source color indicator */}
        <div className="grid-source-indicator" style={{ background: sourceColor }} />
      </div>

      {ctx && <CtxMenu x={ctx.x} y={ctx.y} clip={clip} onClose={() => setCtx(null)} />}
    </>
  );
});

// context menu
function CtxMenu({ x, y, clip, onClose }: { x: number; y: number; clip: Clip; onClose: () => void }) {
  const setPreviewClipId = useUiStore((s) => s.setPreviewClipId);
  const setDetailClipId = useUiStore((s) => s.setDetailClipId);
  const setTagManagerClipId = useUiStore((s) => s.setTagManagerClipId);
  const setTrimClipId = useUiStore((s) => s.setTrimClipId);
  const setCompressClipId = useUiStore((s) => s.setCompressClipId);

  const handleBg = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const play = () => { setPreviewClipId(clip.id); onClose(); };
  const detail = () => { setDetailClipId(clip.id); onClose(); };
  const editTags = () => { setTagManagerClipId(clip.id); setDetailClipId(clip.id); onClose(); };
  const trim = () => { setTrimClipId(clip.id); onClose(); };
  const compress = () => { setCompressClipId(clip.id); onClose(); };
  const openExplorer = async () => {
    try {
      await invoke("open_in_explorer", { path: clip.path });
    } catch (e) { console.warn("open explorer:", e); }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }} onMouseDown={handleBg}>
      <div className="ctx-menu" style={{ left: x, top: y }}>
        <button className="ctx-item" onClick={play}>Play</button>
        <button className="ctx-item" onClick={detail}>Details</button>
        <button className="ctx-item" onClick={editTags}>Edit tags</button>
        <div className="ctx-divider" />
        <button className="ctx-item" onClick={trim}>Trim / GIF</button>
        <button className="ctx-item" onClick={compress}>Compress</button>
        <div className="ctx-divider" />
        <button className="ctx-item" onClick={openExplorer}>Open in Explorer</button>
      </div>
    </div>
  );
}
