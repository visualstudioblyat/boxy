import { memo, useEffect, useCallback, useRef, useState } from "react";
import { useUiStore, useClipStore } from "../store";
import { localUrl, fmtSize } from "../utils";
import { SPEED_OPTIONS } from "../constants";

export default memo(function VideoPreview() {
  const previewClipId = useUiStore((s) => s.previewClipId);
  const setPreviewClipId = useUiStore((s) => s.setPreviewClipId);
  const clips = useClipStore((s) => s.clips);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);

  const clip = clips.find((c) => c.id === previewClipId);
  const idx = clips.findIndex((c) => c.id === previewClipId);

  const close = useCallback(() => setPreviewClipId(null), [setPreviewClipId]);
  const prev = useCallback(() => {
    if (idx > 0) setPreviewClipId(clips[idx - 1].id);
  }, [idx, clips, setPreviewClipId]);
  const next = useCallback(() => {
    if (idx < clips.length - 1) setPreviewClipId(clips[idx + 1].id);
  }, [idx, clips, setPreviewClipId]);

  // apply speed to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, previewClipId]);

  // reset speed when clip changes
  useEffect(() => { setSpeed(1); }, [previewClipId]);

  useEffect(() => {
    if (!previewClipId) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "[") {
        setSpeed((s) => {
          const i = SPEED_OPTIONS.indexOf(s);
          return i > 0 ? SPEED_OPTIONS[i - 1] : s;
        });
      }
      if (e.key === "]") {
        setSpeed((s) => {
          const i = SPEED_OPTIONS.indexOf(s);
          return i < SPEED_OPTIONS.length - 1 ? SPEED_OPTIONS[i + 1] : s;
        });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [previewClipId, close, prev, next]);

  if (!clip) return null;

  const videoSrc = localUrl(clip.path);

  return (
    <div className="preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <button className="preview-close" onClick={close}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {idx > 0 && (
        <button className="preview-nav prev" onClick={prev}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      <video
        ref={videoRef}
        className="preview-video"
        src={videoSrc}
        controls
        autoPlay
        key={clip.id}
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.playbackRate = speed;
        }}
      />

      {idx < clips.length - 1 && (
        <button className="preview-nav next" onClick={next}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <div className="preview-info">
        <span className="preview-filename">{clip.filename}</span>
        <span className="preview-meta">{fmtSize(clip.fileSize)}</span>
        <span className="preview-meta">{idx + 1} / {clips.length}</span>
        <div className="speed-pills">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`speed-pill ${speed === s ? "active" : ""}`}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
