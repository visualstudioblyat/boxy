import { memo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTagStore, useClipStore } from "../store";
import { TAG_COLORS } from "../constants";

interface Props {
  clipId: string;
  clipTags: string[];
}

export default memo(function TagManager({ clipId, clipTags }: Props) {
  const tags = useTagStore((s) => s.tags);
  const setTags = useTagStore((s) => s.setTags);
  const updateClip = useClipStore((s) => s.updateClip);
  const [input, setInput] = useState("");

  const activeTags = tags.filter((t) => clipTags.includes(t.id));

  const addTag = async () => {
    const name = input.trim().toLowerCase();
    if (!name) return;

    try {
      // check if tag exists
      let tag = tags.find((t) => t.name === name);
      if (!tag) {
        // create new tag
        const color = TAG_COLORS[tags.length % TAG_COLORS.length];
        const created = await invoke<import("../types").Tag>("create_tag", { name, color });
        tag = created;
        setTags((prev) => [...prev, created]);
      }

      // add to clip
      if (tag && !clipTags.includes(tag.id)) {
        await invoke("add_tag", { clipId, tagId: tag.id });
        updateClip(clipId, { tags: [...clipTags, tag.id] });
      }

      setInput("");
    } catch (e) {
      console.warn("add tag:", e);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      await invoke("remove_tag", { clipId, tagId });
      updateClip(clipId, { tags: clipTags.filter((id) => id !== tagId) });
    } catch (e) {
      console.warn("remove tag:", e);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addTag();
  };

  return (
    <div className="tag-manager">
      {activeTags.length > 0 && (
        <div className="tag-manager-list">
          {activeTags.map((t) => (
            <span key={t.id} className="tag-badge">
              <span className="tag-dot" style={{ background: t.color }} />
              {t.name}
              <span className="tag-remove" onClick={() => removeTag(t.id)}>×</span>
            </span>
          ))}
        </div>
      )}
      <div className="tag-input-wrap">
        <input
          className="tag-input"
          placeholder="add tag..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="tag-add-btn" onClick={addTag}>+</button>
      </div>
    </div>
  );
});
