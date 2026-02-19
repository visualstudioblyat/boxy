import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useClipStore, useUiStore, useTagStore, useSearchStore, useCollectionStore } from "./store";
import type { Clip, Tag, ScanProgress, SearchResult, Collection, SmartFolder, SmartFolderRule } from "./types";
import { evaluateSmartFolder } from "./utils";
import TitleBar from "./components/TitleBar";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import GridView from "./components/GridView";
import TimelineView from "./components/TimelineView";
import VideoPreview from "./components/VideoPreview";
import ClipDetail from "./components/ClipDetail";
import TrimEditor from "./components/TrimEditor";
import CompressDialog from "./components/CompressDialog";
import Settings from "./components/Settings";

// debounce helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debounce = <T extends (...args: any[]) => void>(fn: T, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export default function App() {
  const clips = useClipStore((s) => s.clips);
  const loading = useClipStore((s) => s.loading);
  const scanProgress = useClipStore((s) => s.scanProgress);
  const setClips = useClipStore((s) => s.setClips);
  const setLoading = useClipStore((s) => s.setLoading);
  const setScanProgress = useClipStore((s) => s.setScanProgress);
  const viewMode = useUiStore((s) => s.viewMode);
  const sort = useUiStore((s) => s.sort);
  const filter = useUiStore((s) => s.filter);
  const detailClipId = useUiStore((s) => s.detailClipId);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const trimClipId = useUiStore((s) => s.trimClipId);
  const compressClipId = useUiStore((s) => s.compressClipId);
  const setTags = useTagStore((s) => s.setTags);
  const query = useSearchStore((s) => s.query);
  const semanticMode = useSearchStore((s) => s.semanticMode);
  const semanticResults = useSearchStore((s) => s.semanticResults);
  const setSemanticResults = useSearchStore((s) => s.setSemanticResults);
  const setSemanticLoading = useSearchStore((s) => s.setSemanticLoading);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const activeCollectionId = useCollectionStore((s) => s.activeCollectionId);
  const activeSmartFolderId = useCollectionStore((s) => s.activeSmartFolderId);
  const activeCollectionClipIds = useCollectionStore((s) => s.activeCollectionClipIds);
  const setActiveCollectionClipIds = useCollectionStore((s) => s.setActiveCollectionClipIds);
  const smartFolders = useCollectionStore((s) => s.smartFolders);

  const ffmpegMissing = useUiStore((s) => s.ffmpegMissing);
  const setFfmpegMissing = useUiStore((s) => s.setFfmpegMissing);
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [updating, setUpdating] = useState(false);

  // init: check ffmpeg, scan clips + load tags, then generate thumbnails
  useEffect(() => {
    const init = async () => {
      try {
        // check ffmpeg availability
        const hasFFmpeg = await invoke<boolean>("check_ffmpeg").catch(() => false);
        if (!hasFFmpeg) setFfmpegMissing(true);

        const [scanned, tags] = await Promise.all([
          invoke<Clip[]>("scan_clips"),
          invoke<Tag[]>("get_tags"),
        ]);
        setClips(scanned);
        setTags(tags);

        // kick off thumbnail generation in background (only if ffmpeg is available)
        if (hasFFmpeg) {
          invoke("gen_all_thumbs").catch((e) => console.warn("thumbs:", e));
        }
      } catch (e) {
        console.warn("init:", e);
      }
      setLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // check for updates
  useEffect(() => {
    check().then((update) => {
      if (update?.available) setUpdateAvailable(update);
    }).catch(() => {}); // silent fail if no pubkey or offline
  }, []);

  const doUpdate = async () => {
    if (!updateAvailable) return;
    setUpdating(true);
    try {
      await updateAvailable.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.warn("update failed:", e);
      setUpdating(false);
    }
  };

  // listen for thumb progress
  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (e) => {
      setScanProgress(e.payload);
      if (e.payload.phase === "complete") setScanProgress(null);
    });
    return () => { unlisten.then((f) => f()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // listen for thumb updates
  useEffect(() => {
    const unlisten = listen<{ clipId: string; thumbPath: string }>("thumb-ready", (e) => {
      const { clipId, thumbPath } = e.payload;
      useClipStore.getState().updateClip(clipId, { thumbPath });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  // listen for watcher-triggered rescan
  useEffect(() => {
    const unlisten = listen("clips-updated", async () => {
      const clips = await invoke<Clip[]>("get_clips");
      setClips(clips);
    });
    return () => { unlisten.then((f) => f()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // load collection clip IDs when active collection changes
  useEffect(() => {
    if (!activeCollectionId || activeCollectionId === "__starred") {
      setActiveCollectionClipIds([]);
      return;
    }
    invoke<string[]>("get_collection_clips", { collectionId: activeCollectionId })
      .then(setActiveCollectionClipIds)
      .catch(console.warn);
  }, [activeCollectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // semantic search (debounced)
  const doSemantic = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) { setSemanticResults([]); setSemanticLoading(false); return; }
      try {
        const results = await invoke<SearchResult[]>("semantic_search", { query: q, limit: 50 });
        setSemanticResults(results);
      } catch (e) {
        console.warn("semantic search:", e);
      }
      setSemanticLoading(false);
    }, 400),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (semanticMode && query.trim()) {
      setSemanticLoading(true);
      doSemantic(query);
    } else {
      setSemanticResults([]);
    }
  }, [query, semanticMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // filter + sort clips
  const filtered = useMemo(() => {
    let result = [...clips];

    // collection / smart folder filtering
    if (activeCollectionId === "__starred") {
      result = result.filter((c) => c.starred);
    } else if (activeCollectionId && activeCollectionClipIds.length > 0) {
      const idSet = new Set(activeCollectionClipIds);
      result = result.filter((c) => idSet.has(c.id));
    } else if (activeSmartFolderId) {
      const sf = smartFolders.find((f) => f.id === activeSmartFolderId);
      if (sf) {
        try {
          const rules: SmartFolderRule[] = JSON.parse(sf.rules);
          result = evaluateSmartFolder(result, rules);
        } catch { /* invalid rules, show all */ }
      }
    }

    // semantic mode: only show clips with embeddings that match
    if (semanticMode && semanticResults.length > 0) {
      const scoreMap = new Map(semanticResults.map((r) => [r.clipId, r.score]));
      result = result.filter((c) => scoreMap.has(c.id));
      result.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
      return result;
    }

    // text search
    const q = query.toLowerCase().trim();
    if (q && !semanticMode) {
      result = result.filter((c) =>
        c.filename.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((tid) => {
          const tag = useTagStore.getState().tags.find((t) => t.id === tid);
          return tag?.name.toLowerCase().includes(q);
        })
      );
    }

    // date filter
    if (filter.dateFrom) {
      const from = filter.dateFrom / 1000;
      result = result.filter((c) => c.recordedAt >= from);
    }
    if (filter.dateTo) {
      const to = filter.dateTo / 1000;
      result = result.filter((c) => c.recordedAt <= to);
    }

    // tag filter
    if (filter.tags.length > 0) {
      result = result.filter((c) => filter.tags.every((tid) => c.tags.includes(tid)));
    }

    // source filter
    if (filter.dirSource !== "all") {
      result = result.filter((c) => c.dirSource === filter.dirSource);
    }

    // starred filter
    if (filter.starred === true) {
      result = result.filter((c) => c.starred);
    } else if (filter.starred === false) {
      result = result.filter((c) => !c.starred);
    }

    // sort
    const dir = sort.dir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv as string) * dir;
      return ((av as number) - (bv as number)) * dir;
    });

    return result;
  }, [clips, query, semanticMode, semanticResults, filter, sort, activeCollectionId, activeCollectionClipIds, activeSmartFolderId, smartFolders]);

  // keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(".search-input");
        el?.focus();
      }
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        useUiStore.getState().selectAll(filtered.map((c) => c.id));
      }
      if (e.key === "Escape") {
        const s = useUiStore.getState();
        if (s.selectedClipIds.size > 0) s.clearSelection();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [filtered]);

  return (
    <div className="app-layout">
      <TitleBar />
      <Toolbar />

      {ffmpegMissing && (
        <div className="ffmpeg-banner">
          <span>ffmpeg not found. Thumbnails, trimming, GIF export, and compression won't work.</span>
          <span className="ffmpeg-banner-cmds">
            Install: <code>winget install FFmpeg</code> or <code>choco install ffmpeg</code>
          </span>
          <button className="ffmpeg-banner-close" onClick={() => setFfmpegMissing(false)}>Dismiss</button>
        </div>
      )}

      {updateAvailable && (
        <div className="update-banner">
          <span>Boxy v{updateAvailable.version} is available!</span>
          <button className="update-banner-btn" onClick={doUpdate} disabled={updating}>
            {updating ? "Updating..." : "Install & Restart"}
          </button>
          <button className="update-banner-close" onClick={() => setUpdateAvailable(null)}>Later</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Scanning clips...</span>
          {scanProgress && (
            <div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${(scanProgress.done / scanProgress.total) * 100}%` }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textAlign: "center" }}>
                {scanProgress.done} / {scanProgress.total}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="main-area">
          <Sidebar />
          <div className="content-area">
            {viewMode === "grid" ? (
              <GridView clips={filtered} />
            ) : (
              <TimelineView clips={filtered} />
            )}
          </div>
          {detailClipId && <ClipDetail />}
        </div>
      )}

      <VideoPreview />
      {trimClipId && <TrimEditor />}
      {compressClipId && <CompressDialog />}
      {settingsOpen && <Settings />}
    </div>
  );
}
