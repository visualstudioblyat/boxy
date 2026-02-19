import { memo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore, useClipStore, useTagStore } from "../store";

export default memo(function BulkBar() {
  const selectedClipIds = useUiStore((s) => s.selectedClipIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const setClips = useClipStore((s) => s.setClips);
  const tags = useTagStore((s) => s.tags);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  const ids = [...selectedClipIds];
  const count = ids.length;

  const handleBulkStar = async () => {
    try {
      await invoke("bulk_star", { clipIds: ids, starred: true });
      for (const id of ids) useClipStore.getState().updateClip(id, { starred: true });
    } catch (e) { console.warn("bulk star:", e); }
  };

  const handleBulkDelete = async () => {
    try {
      await invoke("delete_clips", { ids });
      setClips((prev) => prev.filter((c) => !selectedClipIds.has(c.id)));
      clearSelection();
    } catch (e) { console.warn("bulk delete:", e); }
  };

  const handleBulkTag = async (tagId: string) => {
    try {
      await invoke("bulk_add_tag", { clipIds: ids, tagId });
      const clips = useClipStore.getState().clips;
      for (const id of ids) {
        const clip = clips.find((c) => c.id === id);
        if (clip && !clip.tags.includes(tagId)) {
          useClipStore.getState().updateClip(id, { tags: [...clip.tags, tagId] });
        }
      }
    } catch (e) { console.warn("bulk tag:", e); }
    setTagMenuOpen(false);
  };

  return (
    <div className="toolbar bulk-bar">
      <span className="bulk-count">{count} selected</span>

      <div className="toolbar-divider" />

      <div style={{ position: "relative" }}>
        <button className="toolbar-btn" onClick={() => setTagMenuOpen(!tagMenuOpen)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
          </svg>
          Tag
        </button>
        {tagMenuOpen && (
          <div className="sort-menu" style={{ left: 0 }}>
            {tags.map((t) => (
              <button key={t.id} className="sort-item" onClick={() => handleBulkTag(t.id)}>
                <span className="tag-dot" style={{ background: t.color }} />
                {t.name}
              </button>
            ))}
            {tags.length === 0 && <div className="sort-item" style={{ color: "var(--text-dim)" }}>No tags</div>}
          </div>
        )}
      </div>

      <button className="toolbar-btn" onClick={handleBulkStar}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
        Star
      </button>

      <button className="toolbar-btn" onClick={handleBulkDelete} style={{ color: "var(--danger)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
        Delete
      </button>

      <div style={{ flex: 1 }} />

      <button className="toolbar-btn" onClick={clearSelection}>
        Deselect All
      </button>
    </div>
  );
});
