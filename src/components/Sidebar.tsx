import { memo, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore, useClipStore, useCollectionStore } from "../store";
import type { Collection, SmartFolder } from "../types";

export default memo(function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const clips = useClipStore((s) => s.clips);
  const {
    collections, setCollections,
    smartFolders, setSmartFolders,
    activeCollectionId, setActiveCollectionId,
    activeSmartFolderId, setActiveSmartFolderId,
  } = useCollectionStore();

  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingSmartFolder, setEditingSmartFolder] = useState<SmartFolder | null>(null);
  const [showNewSmartFolder, setShowNewSmartFolder] = useState(false);

  // load collections + smart folders on mount
  useEffect(() => {
    invoke<Collection[]>("get_collections").then(setCollections).catch(console.warn);
    invoke<SmartFolder[]>("get_smart_folders").then(setSmartFolders).catch(console.warn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sidebarOpen) return null;

  const starredCount = clips.filter((c) => c.starred).length;

  const handleDeleteCollection = async (id: string) => {
    try {
      await invoke("delete_collection", { id });
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (activeCollectionId === id) setActiveCollectionId(null);
    } catch (e) { console.warn("delete collection:", e); }
  };

  const handleDeleteSmartFolder = async (id: string) => {
    try {
      await invoke("delete_smart_folder", { id });
      setSmartFolders((prev) => prev.filter((f) => f.id !== id));
      if (activeSmartFolderId === id) setActiveSmartFolderId(null);
    } catch (e) { console.warn("delete smart folder:", e); }
  };

  return (
    <div className="sidebar">
      {/* navigation */}
      <div className="sidebar-section">
        <button
          className={`sidebar-item ${!activeCollectionId && !activeSmartFolderId ? "active" : ""}`}
          onClick={() => { setActiveCollectionId(null); setActiveSmartFolderId(null); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>All Clips</span>
          <span className="sidebar-count">{clips.length}</span>
        </button>
        <button
          className={`sidebar-item ${activeCollectionId === "__starred" ? "active" : ""}`}
          onClick={() => setActiveCollectionId("__starred")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
          <span>Starred</span>
          <span className="sidebar-count">{starredCount}</span>
        </button>
      </div>

      {/* collections */}
      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Collections</span>
          <button className="sidebar-add" onClick={() => setShowNewCollection(true)} title="New collection">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {collections.map((col) => (
          <button
            key={col.id}
            className={`sidebar-item ${activeCollectionId === col.id ? "active" : ""}`}
            onClick={() => setActiveCollectionId(col.id)}
            onContextMenu={(e) => { e.preventDefault(); setEditingCollection(col); }}
          >
            <span className="sidebar-dot" style={{ background: col.color }} />
            <span>{col.name}</span>
            <span className="sidebar-count">{col.clipCount}</span>
          </button>
        ))}
      </div>

      {/* smart folders */}
      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Smart Folders</span>
          <button className="sidebar-add" onClick={() => setShowNewSmartFolder(true)} title="New smart folder">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {smartFolders.map((sf) => (
          <button
            key={sf.id}
            className={`sidebar-item ${activeSmartFolderId === sf.id ? "active" : ""}`}
            onClick={() => setActiveSmartFolderId(sf.id)}
            onContextMenu={(e) => { e.preventDefault(); setEditingSmartFolder(sf); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sf.color} strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span>{sf.name}</span>
          </button>
        ))}
      </div>

      {/* modals */}
      {(showNewCollection || editingCollection) && (
        <CollectionEditor
          collection={editingCollection}
          onClose={() => { setShowNewCollection(false); setEditingCollection(null); }}
          onDelete={editingCollection ? () => handleDeleteCollection(editingCollection.id) : undefined}
        />
      )}
      {(showNewSmartFolder || editingSmartFolder) && (
        <SmartFolderEditor
          smartFolder={editingSmartFolder}
          onClose={() => { setShowNewSmartFolder(false); setEditingSmartFolder(null); }}
          onDelete={editingSmartFolder ? () => handleDeleteSmartFolder(editingSmartFolder.id) : undefined}
        />
      )}
    </div>
  );
});

/* ── Collection Editor Modal ── */

function CollectionEditor({ collection, onClose, onDelete }: {
  collection: Collection | null;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const setCollections = useCollectionStore((s) => s.setCollections);
  const [name, setName] = useState(collection?.name ?? "");
  const [color, setColor] = useState(collection?.color ?? "#6366f1");

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6"];

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (collection) {
        // update — re-fetch all
        await invoke("create_collection", { name: name.trim(), color });
        const fresh = await invoke<Collection[]>("get_collections");
        setCollections(fresh);
      } else {
        await invoke("create_collection", { name: name.trim(), color });
        const fresh = await invoke<Collection[]>("get_collections");
        setCollections(fresh);
      }
      onClose();
    } catch (e) { console.warn("save collection:", e); }
  };

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel" style={{ width: 360 }}>
        <div className="detail-header">
          <span className="detail-title">{collection ? "Edit Collection" : "New Collection"}</span>
          <button className="detail-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="detail-section">
          <div className="detail-label">Name</div>
          <input
            className="tag-input"
            style={{ width: "100%", height: 34 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
            placeholder="Collection name..."
          />
        </div>
        <div className="detail-section">
          <div className="detail-label">Color</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                className="sidebar-color-swatch"
                style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="detail-section" style={{ display: "flex", gap: 8 }}>
          <button className="detail-play-btn" style={{ flex: 1, marginTop: 0 }} onClick={handleSave}>
            {collection ? "Update" : "Create"}
          </button>
          {onDelete && (
            <button
              className="detail-play-btn"
              style={{ flex: 0, marginTop: 0, background: "var(--danger)", padding: "0 16px" }}
              onClick={() => { onDelete(); onClose(); }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Smart Folder Editor Modal ── */

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "starred", label: "Starred" },
  { value: "filename", label: "Filename" },
  { value: "dirSource", label: "Source" },
  { value: "fileSize", label: "File Size" },
  { value: "durationSecs", label: "Duration" },
  { value: "recordedAt", label: "Date" },
  { value: "tag", label: "Tag" },
];

const OP_MAP: Record<string, { value: string; label: string }[]> = {
  starred: [{ value: "is", label: "is" }],
  filename: [{ value: "contains", label: "contains" }, { value: "equals", label: "equals" }],
  dirSource: [{ value: "equals", label: "equals" }],
  fileSize: [{ value: "gt", label: ">" }, { value: "lt", label: "<" }, { value: "between", label: "between" }],
  durationSecs: [{ value: "gt", label: ">" }, { value: "lt", label: "<" }, { value: "between", label: "between" }],
  recordedAt: [{ value: "gt", label: "after" }, { value: "lt", label: "before" }],
  tag: [{ value: "has", label: "has" }],
};

interface RuleRow {
  field: string;
  operator: string;
  value: string;
  value2: string;
}

function SmartFolderEditor({ smartFolder, onClose, onDelete }: {
  smartFolder: SmartFolder | null;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const setSmartFolders = useCollectionStore((s) => s.setSmartFolders);
  const [name, setName] = useState(smartFolder?.name ?? "");
  const [color, setColor] = useState(smartFolder?.color ?? "#06b6d4");

  const parseRules = (): RuleRow[] => {
    if (!smartFolder?.rules) return [{ field: "starred", operator: "is", value: "true", value2: "" }];
    try {
      const parsed = JSON.parse(smartFolder.rules);
      return parsed.map((r: { field: string; operator: string; value?: unknown; value2?: unknown }) => ({
        field: r.field ?? "starred",
        operator: r.operator ?? "is",
        value: String(r.value ?? ""),
        value2: String(r.value2 ?? ""),
      }));
    } catch { return [{ field: "starred", operator: "is", value: "true", value2: "" }]; }
  };

  const [rules, setRules] = useState<RuleRow[]>(parseRules);

  const COLORS = ["#06b6d4", "#6366f1", "#8b5cf6", "#ec4899", "#22c55e", "#f97316", "#eab308", "#3b82f6"];

  const updateRule = (i: number, partial: Partial<RuleRow>) => {
    setRules((prev) => prev.map((r, j) => j === i ? { ...r, ...partial } : r));
  };

  const addRule = () => {
    setRules((prev) => [...prev, { field: "starred", operator: "is", value: "true", value2: "" }]);
  };

  const removeRule = (i: number) => {
    setRules((prev) => prev.filter((_, j) => j !== i));
  };

  const handleSave = async () => {
    if (!name.trim() || rules.length === 0) return;
    const rulesJson = JSON.stringify(rules.map((r) => ({
      field: r.field,
      operator: r.operator,
      value: r.field === "starred" ? r.value === "true" : ["fileSize", "durationSecs", "recordedAt"].includes(r.field) ? Number(r.value) : r.value,
      ...(r.value2 ? { value2: Number(r.value2) } : {}),
    })));
    try {
      if (smartFolder) {
        await invoke("update_smart_folder", { id: smartFolder.id, name: name.trim(), color, rules: rulesJson });
      } else {
        await invoke("create_smart_folder", { name: name.trim(), color, rules: rulesJson });
      }
      const fresh = await invoke<SmartFolder[]>("get_smart_folders");
      setSmartFolders(fresh);
      onClose();
    } catch (e) { console.warn("save smart folder:", e); }
  };

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel" style={{ width: 480 }}>
        <div className="detail-header">
          <span className="detail-title">{smartFolder ? "Edit Smart Folder" : "New Smart Folder"}</span>
          <button className="detail-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="detail-section">
          <div className="detail-label">Name</div>
          <input
            className="tag-input"
            style={{ width: "100%", height: 34 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Smart folder name..."
          />
        </div>
        <div className="detail-section">
          <div className="detail-label">Color</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                className="sidebar-color-swatch"
                style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="detail-section">
          <div className="detail-label" style={{ marginBottom: 8 }}>Rules (all must match)</div>
          {rules.map((rule, i) => (
            <div key={i} className="smart-rule-row">
              <select className="smart-rule-select" value={rule.field} onChange={(e) => {
                const f = e.target.value;
                const ops = OP_MAP[f] ?? [];
                updateRule(i, { field: f, operator: ops[0]?.value ?? "is", value: "", value2: "" });
              }}>
                {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select className="smart-rule-select" value={rule.operator} onChange={(e) => updateRule(i, { operator: e.target.value })}>
                {(OP_MAP[rule.field] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {rule.field === "starred" ? (
                <select className="smart-rule-select" value={rule.value} onChange={(e) => updateRule(i, { value: e.target.value })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  className="smart-rule-input"
                  placeholder="value"
                  value={rule.value}
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                />
              )}
              {rule.operator === "between" && (
                <input
                  className="smart-rule-input"
                  placeholder="max"
                  value={rule.value2}
                  onChange={(e) => updateRule(i, { value2: e.target.value })}
                />
              )}
              <button className="smart-rule-remove" onClick={() => removeRule(i)} title="Remove rule">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button className="toolbar-btn" style={{ marginTop: 8, fontSize: 11 }} onClick={addRule}>+ Add Rule</button>
        </div>
        <div className="detail-section" style={{ display: "flex", gap: 8 }}>
          <button className="detail-play-btn" style={{ flex: 1, marginTop: 0 }} onClick={handleSave}>
            {smartFolder ? "Update" : "Create"}
          </button>
          {onDelete && (
            <button
              className="detail-play-btn"
              style={{ flex: 0, marginTop: 0, background: "var(--danger)", padding: "0 16px" }}
              onClick={() => { onDelete(); onClose(); }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
