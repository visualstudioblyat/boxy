import { memo, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore, useClipStore, useTagStore } from "../store";
import { localUrl, fmtSize } from "../utils";
import TagManager from "./TagManager";
import Waveform from "./Waveform";

const fmtDetailDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (secs: number | null) => {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const fmtRes = (w: number | null, h: number | null) => {
  if (!w || !h) return "—";
  return `${w}×${h}`;
};

export default memo(function ClipDetail() {
  const detailClipId = useUiStore((s) => s.detailClipId);
  const setDetailClipId = useUiStore((s) => s.setDetailClipId);
  const setPreviewClipId = useUiStore((s) => s.setPreviewClipId);
  const setTrimClipId = useUiStore((s) => s.setTrimClipId);
  const setCompressClipId = useUiStore((s) => s.setCompressClipId);
  const clips = useClipStore((s) => s.clips);
  const updateClip = useClipStore((s) => s.updateClip);

  const clip = clips.find((c) => c.id === detailClipId);
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (clip) setDesc(clip.description);
  }, [clip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clip) return null;

  const thumbSrc = clip.thumbPath ? localUrl(clip.thumbPath) : null;

  const saveDesc = async () => {
    if (desc === clip.description) return;
    try {
      await invoke("update_description", { clipId: clip.id, desc });
      updateClip(clip.id, { description: desc });
    } catch (e) {
      console.warn("save desc:", e);
    }
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-title">Details</span>
        <button className="detail-close" onClick={() => setDetailClipId(null)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {thumbSrc ? (
        <img className="detail-thumb" src={thumbSrc} alt="" />
      ) : (
        <div className="grid-thumb-placeholder" style={{ width: "100%", aspectRatio: "16/9" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
      )}

      <div className="detail-section" style={{ display: "flex", gap: 8 }}>
        <button className="detail-play-btn" style={{ flex: 1, marginTop: 0 }} onClick={() => setPreviewClipId(clip.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Play
        </button>
        <button
          className={`detail-star-btn ${clip.starred ? "starred" : ""}`}
          onClick={async () => {
            const next = !clip.starred;
            updateClip(clip.id, { starred: next });
            try { await invoke("toggle_star", { clipId: clip.id, starred: next }); }
            catch { updateClip(clip.id, { starred: !next }); }
          }}
          title={clip.starred ? "Unstar" : "Star"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={clip.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </button>
      </div>

      <div className="detail-section">
        <div className="detail-label">Filename</div>
        <div className="detail-value">{clip.filename}</div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Recorded</div>
        <div className="detail-value">{fmtDetailDate(clip.recordedAt)}</div>
      </div>

      <div className="detail-section" style={{ display: "flex", gap: 16 }}>
        <div>
          <div className="detail-label">Size</div>
          <div className="detail-value">{fmtSize(clip.fileSize)}</div>
        </div>
        <div>
          <div className="detail-label">Duration</div>
          <div className="detail-value">{fmtDuration(clip.durationSecs)}</div>
        </div>
        <div>
          <div className="detail-label">Resolution</div>
          <div className="detail-value">{fmtRes(clip.width, clip.height)}</div>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Source</div>
        <div className="detail-value">{clip.dirSource === "root" ? "Videos" : "Captures"}</div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Path</div>
        <div className="detail-value" style={{ fontSize: 11 }}>{clip.path}</div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Tags</div>
        <TagManager clipId={clip.id} clipTags={clip.tags} />
      </div>

      <div className="detail-section">
        <div className="detail-label">Waveform</div>
        <Waveform clipId={clip.id} videoPath={clip.path} />
      </div>

      <div className="detail-section">
        <div className="detail-label">Actions</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <button className="detail-action-btn" onClick={() => setTrimClipId(clip.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
            </svg>
            Trim
          </button>
          <button className="detail-action-btn" onClick={() => { setTrimClipId(clip.id); }}>
            GIF
          </button>
          <button className="detail-action-btn" onClick={() => setCompressClipId(clip.id)}>
            Compress
          </button>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Description</div>
        <textarea
          className="detail-desc-input"
          placeholder="describe this clip for search..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDesc}
        />
      </div>
    </div>
  );
});
