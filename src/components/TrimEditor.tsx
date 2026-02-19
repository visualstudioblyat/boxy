import { memo, useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useUiStore, useClipStore } from "../store";
import { localUrl, fmtDuration } from "../utils";

export default memo(function TrimEditor() {
  const trimClipId = useUiStore((s) => s.trimClipId);
  const setTrimClipId = useUiStore((s) => s.setTrimClipId);
  const clips = useClipStore((s) => s.clips);

  const clip = clips.find((c) => c.id === trimClipId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [precise, setPrecise] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<"trim" | "gif">("trim");

  // GIF options
  const [gifWidth, setGifWidth] = useState(480);
  const [gifFps, setGifFps] = useState(15);

  useEffect(() => {
    if (clip?.durationSecs) {
      setEnd(clip.durationSecs);
      setDuration(clip.durationSecs);
    }
    setStart(0);
  }, [clip?.id, clip?.durationSecs]);

  const close = useCallback(() => setTrimClipId(null), [setTrimClipId]);

  if (!clip) return null;

  const videoSrc = localUrl(clip.path);

  const handleTrim = async () => {
    const ext = clip.filename.split(".").pop() || "mp4";
    const outPath = await save({
      defaultPath: `${clip.filename.replace(`.${ext}`, "")}_trimmed.${ext}`,
      filters: [{ name: "Video", extensions: [ext] }],
    });
    if (!outPath) return;
    setProcessing(true);
    try {
      await invoke("trim_clip", { input: clip.path, output: outPath, start, end, precise });
    } catch (e) {
      console.warn("trim:", e);
    }
    setProcessing(false);
    close();
  };

  const handleGif = async () => {
    const outPath = await save({
      defaultPath: `${clip.filename.replace(/\.[^.]+$/, "")}.gif`,
      filters: [{ name: "GIF", extensions: ["gif"] }],
    });
    if (!outPath) return;
    setProcessing(true);
    try {
      await invoke("export_gif", { input: clip.path, output: outPath, start, end, width: gifWidth, fps: gifFps });
    } catch (e) {
      console.warn("gif:", e);
    }
    setProcessing(false);
    close();
  };

  const seekPreview = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget && !processing) close(); }}>
      <div className="trim-editor">
        <div className="detail-header">
          <span className="detail-title">{mode === "trim" ? "Trim Clip" : "Export GIF"}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className={`toolbar-btn ${mode === "trim" ? "active" : ""}`}
              onClick={() => setMode("trim")}
              style={{ fontSize: 11, padding: "0 8px", height: 28 }}
            >Trim</button>
            <button
              className={`toolbar-btn ${mode === "gif" ? "active" : ""}`}
              onClick={() => setMode("gif")}
              style={{ fontSize: 11, padding: "0 8px", height: 28 }}
            >GIF</button>
          </div>
          <button className="detail-close" onClick={close}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <video
          ref={videoRef}
          className="trim-video"
          src={videoSrc}
          controls
          onLoadedMetadata={() => {
            if (videoRef.current && videoRef.current.duration) {
              setDuration(videoRef.current.duration);
              setEnd(videoRef.current.duration);
            }
          }}
        />

        <div className="trim-controls">
          <div className="trim-range">
            <div className="trim-range-track">
              <div
                className="trim-range-selected"
                style={{
                  left: `${(start / duration) * 100}%`,
                  width: `${((end - start) / duration) * 100}%`,
                }}
              />
              <input
                type="range"
                className="trim-handle"
                min={0}
                max={duration}
                step={0.01}
                value={start}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setStart(Math.min(v, end - 0.1));
                  seekPreview(v);
                }}
              />
              <input
                type="range"
                className="trim-handle"
                min={0}
                max={duration}
                step={0.01}
                value={end}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setEnd(Math.max(v, start + 0.1));
                  seekPreview(v);
                }}
              />
            </div>
            <div className="trim-times">
              <span>{fmtDuration(start) ?? "0:00"}</span>
              <span>Duration: {fmtDuration(end - start) ?? "0:00"}</span>
              <span>{fmtDuration(end) ?? "0:00"}</span>
            </div>
          </div>

          {mode === "trim" && (
            <label className="trim-precise">
              <input type="checkbox" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />
              <span>Precise mode (re-encode, slower but frame-accurate)</span>
            </label>
          )}

          {mode === "gif" && (
            <div className="trim-gif-opts">
              <label>
                <span className="detail-label">Width</span>
                <select className="smart-rule-select" value={gifWidth} onChange={(e) => setGifWidth(Number(e.target.value))}>
                  <option value={320}>320px</option>
                  <option value={480}>480px</option>
                  <option value={640}>640px</option>
                  <option value={800}>800px</option>
                </select>
              </label>
              <label>
                <span className="detail-label">FPS</span>
                <select className="smart-rule-select" value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={24}>24</option>
                </select>
              </label>
            </div>
          )}

          <button
            className="detail-play-btn"
            style={{ marginTop: 8 }}
            onClick={mode === "trim" ? handleTrim : handleGif}
            disabled={processing}
          >
            {processing ? "Processing..." : mode === "trim" ? "Trim & Save" : "Export GIF"}
          </button>
        </div>
      </div>
    </div>
  );
});
