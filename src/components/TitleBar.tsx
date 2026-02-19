import { memo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUiStore } from "../store";

const win = getCurrentWindow();

const Mascot = () => (
  <svg width="24" height="24" viewBox="0 0 100 100" className="titlebar-mascot">
    <rect width="100" height="100" fill="#18181b" rx="20" />
    <path d="M 30 65 C 20 80, 18 100, 18 100 L 82 100 C 82 100, 80 80, 70 65 Z" fill="#fff" />
    <path d="M 38 35 C 22 5, 48 5, 48 38 Z" fill="#fff" />
    <path d="M 62 35 C 78 5, 52 5, 52 38 Z" fill="#fff" />
    <circle cx="50" cy="48" r="26" fill="#fff" />
    <circle cx="34" cy="56" r="4" fill="#ffb7c5" opacity="0.4" />
    <circle cx="66" cy="56" r="4" fill="#ffb7c5" opacity="0.4" />
    <path d="M 38 40 L 39.5 43.5 L 43 43.5 L 40.5 46 L 41.5 49.5 L 38 47.5 L 34.5 49.5 L 35.5 46 L 33 43.5 L 36.5 43.5 Z" fill="#18181b" />
    <path d="M 62 40 L 63.5 43.5 L 67 43.5 L 64.5 46 L 65.5 49.5 L 62 47.5 L 58.5 49.5 L 59.5 46 L 57 43.5 L 60.5 43.5 Z" fill="#18181b" />
    <path d="M 46 54 Q 48 57 50 54 Q 52 57 54 54" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M 24 63 Q 50 83 76 63 L 78 81 Q 50 101 22 81 Z" fill="#18181b" />
    <path d="M 25 72 Q 50 92 75 72" stroke="#fff" strokeWidth="5" strokeDasharray="9 4" fill="none" opacity="0.9" />
  </svg>
);

export default memo(function TitleBar() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  return (
    <div className="titlebar">
      <Mascot />
      <span className="titlebar-title">Boxy</span>
      <div className="titlebar-spacer" />
      <button className="titlebar-btn" onClick={() => setSettingsOpen(true)} title="Settings">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button className="titlebar-btn" onClick={() => win.minimize()}>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      <button className="titlebar-btn" onClick={() => win.toggleMaximize()}>
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
      </button>
      <button className="titlebar-btn close" onClick={() => win.close()}>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
});
