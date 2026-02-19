import { create } from "zustand";
import type { Clip, ScanProgress } from "../types";

const toggle = <T,>(v: T | ((p: T) => T), prev: T): T =>
  typeof v === "function" ? (v as (p: T) => T)(prev) : v;

interface ClipState {
  clips: Clip[];
  loading: boolean;
  scanProgress: ScanProgress | null;

  setClips: (v: Clip[] | ((p: Clip[]) => Clip[])) => void;
  setLoading: (v: boolean) => void;
  setScanProgress: (v: ScanProgress | null) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
}

export const useClipStore = create<ClipState>((set) => ({
  clips: [],
  loading: true,
  scanProgress: null,

  setClips: (v) => set((s) => ({ clips: toggle(v, s.clips) })),
  setLoading: (v) => set({ loading: v }),
  setScanProgress: (v) => set({ scanProgress: v }),
  updateClip: (id, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
}));
