import { memo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useUiStore, useClipStore } from "../store";
import { fmtSize } from "../utils";

export default memo(function CompressDialog() {
  const compressClipId = useUiStore((s) => s.compressClipId);
  const setCompressClipId = useUiStore((s) => s.setCompressClipId);
  const clips = useClipStore((s) => s.clips);

  const clip = clips.find((c) => c.id === compressClipId);
  const [quality, setQuality] = useState("medium");
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!clip) return null;

  const presets = [
    { key: "high", label: "High", desc: "CRF 22, original size", estimate: 0.7 },
    { key: "medium", label: "Medium", desc: "CRF 28, max 1080p", estimate: 0.4 },
    { key: "low", label: "Low", desc: "CRF 34, max 720p", estimate: 0.2 },
  ];

  const selectedPreset = presets.find((p) => p.key === quality);
  const estimatedSize = clip.fileSize * (selectedPreset?.estimate ?? 0.4);

  const close = () => setCompressClipId(null);

  const handleCompress = async () => {
    const ext = "mp4";
    const outPath = await save({
      defaultPath: `${clip.filename.replace(/\.[^.]+$/, "")}_compressed.${ext}`,
      filters: [{ name: "Video", extensions: [ext] }],
    });
    if (!outPath) return;
    setProcessing(true);
    try {
      await invoke("compress_clip", { input: clip.path, output: outPath, quality, maxWidth });
    } catch (e) {
      console.warn("compress:", e);
    }
    setProcessing(false);
    close();
  };

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget && !processing) close(); }}>
      <div className="settings-panel" style={{ width: 400 }}>
        <div className="detail-header">
          <span className="detail-title">Compress</span>
          <button className="detail-close" onClick={close}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="detail-section">
          <div className="detail-label">Original</div>
          <div className="detail-value">{clip.filename} — {fmtSize(clip.fileSize)}</div>
        </div>

        <div className="detail-section">
          <div className="detail-label" style={{ marginBottom: 8 }}>Quality Preset</div>
          <div className="compress-presets">
            {presets.map((p) => (
              <button
                key={p.key}
                className={`compress-preset ${quality === p.key ? "active" : ""}`}
                onClick={() => setQuality(p.key)}
              >
                <div className="compress-preset-label">{p.label}</div>
                <div className="compress-preset-desc">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-label">Max Width Override</div>
          <select
            className="smart-rule-select"
            style={{ marginTop: 4 }}
            value={maxWidth ?? ""}
            onChange={(e) => setMaxWidth(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Default (per preset)</option>
            <option value={1920}>1920px (1080p)</option>
            <option value={1280}>1280px (720p)</option>
            <option value={854}>854px (480p)</option>
          </select>
        </div>

        <div className="detail-section">
          <div className="detail-label">Estimated Output</div>
          <div className="detail-value">~{fmtSize(estimatedSize)}</div>
        </div>

        <div className="detail-section">
          <button
            className="detail-play-btn"
            style={{ marginTop: 0 }}
            onClick={handleCompress}
            disabled={processing}
          >
            {processing ? "Compressing..." : "Compress & Save"}
          </button>
        </div>
      </div>
    </div>
  );
});
