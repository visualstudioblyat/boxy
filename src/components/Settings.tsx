import { memo, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useUiStore } from "../store";

export default memo(function Settings() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const [dirs, setDirs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<{ watchDirs: string[] }>("get_settings").then((s) => setDirs(s.watchDirs));
  }, []);

  const addDir = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setDirs((prev) => (prev.includes(selected) ? prev : [...prev, selected]));
    }
  }, []);

  const removeDir = useCallback((dir: string) => {
    setDirs((prev) => prev.filter((d) => d !== dir));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await invoke("set_watch_dirs", { dirs });
    } catch (e) {
      console.warn("save settings:", e);
    }
    setSaving(false);
    setSettingsOpen(false);
  }, [dirs, setSettingsOpen]);

  return (
    <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <span className="detail-title">Settings</span>
          <button className="detail-close" onClick={() => setSettingsOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="detail-section">
          <div className="detail-label">Watch Directories</div>
          <div className="settings-dirs">
            {dirs.map((dir) => (
              <div key={dir} className="settings-dir-item">
                <span className="settings-dir-path">{dir}</span>
                <button className="settings-dir-remove" onClick={() => removeDir(dir)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {dirs.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>
                No directories configured. Default Videos folder will be used.
              </div>
            )}
          </div>
          <button className="toolbar-btn" onClick={addDir} style={{ marginTop: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Directory
          </button>
        </div>

        <div className="detail-section" style={{ borderBottom: "none" }}>
          <button className="detail-play-btn" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save & Close"}
          </button>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
            Rescan will pick up changes on next launch
          </div>
        </div>
      </div>
    </div>
  );
});
