import { create } from "zustand";
import type { ClipFilter, SortConfig, ViewMode } from "../types";
import { DEFAULT_FILTER, DEFAULT_SORT } from "../constants";

const toggle = (v: boolean | ((p: boolean) => boolean), prev: boolean) =>
  typeof v === "function" ? v(prev) : v;

interface UiState {
  viewMode: ViewMode;
  sort: SortConfig;
  filter: ClipFilter;
  selectedClipId: string | null;
  selectedClipIds: Set<string>;
  previewClipId: string | null;
  detailClipId: string | null;
  tagManagerClipId: string | null;
  dateFilterOpen: boolean;
  settingsOpen: boolean;
  sidebarOpen: boolean;
  trimClipId: string | null;
  compressClipId: string | null;
  ffmpegMissing: boolean;

  setViewMode: (v: ViewMode) => void;
  setSort: (v: SortConfig) => void;
  setFilter: (v: ClipFilter | ((p: ClipFilter) => ClipFilter)) => void;
  setSelectedClipId: (v: string | null) => void;
  setPreviewClipId: (v: string | null) => void;
  setDetailClipId: (v: string | null) => void;
  setTagManagerClipId: (v: string | null) => void;
  setDateFilterOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setSettingsOpen: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setTrimClipId: (v: string | null) => void;
  setCompressClipId: (v: string | null) => void;
  setFfmpegMissing: (v: boolean) => void;
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  viewMode: "grid",
  sort: DEFAULT_SORT,
  filter: DEFAULT_FILTER,
  selectedClipId: null,
  selectedClipIds: new Set<string>(),
  previewClipId: null,
  detailClipId: null,
  tagManagerClipId: null,
  dateFilterOpen: false,
  settingsOpen: false,
  sidebarOpen: false,
  trimClipId: null,
  compressClipId: null,
  ffmpegMissing: false,

  setViewMode: (v) => set({ viewMode: v }),
  setSort: (v) => set({ sort: v }),
  setFilter: (v) => set((s) => ({ filter: typeof v === "function" ? v(s.filter) : v })),
  setSelectedClipId: (v) => set({ selectedClipId: v }),
  setPreviewClipId: (v) => set({ previewClipId: v }),
  setDetailClipId: (v) => set({ detailClipId: v }),
  setTagManagerClipId: (v) => set({ tagManagerClipId: v }),
  setDateFilterOpen: (v) => set((s) => ({ dateFilterOpen: toggle(v, s.dateFilterOpen) })),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTrimClipId: (v) => set({ trimClipId: v }),
  setCompressClipId: (v) => set({ compressClipId: v }),
  setFfmpegMissing: (v) => set({ ffmpegMissing: v }),
  toggleClipSelection: (id) => set((s) => {
    const next = new Set(s.selectedClipIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedClipIds: next };
  }),
  clearSelection: () => set({ selectedClipIds: new Set<string>() }),
  selectAll: (ids) => set({ selectedClipIds: new Set(ids) }),
}));
