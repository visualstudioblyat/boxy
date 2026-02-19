import { create } from "zustand";
import type { Tag } from "../types";

interface TagState {
  tags: Tag[];
  setTags: (v: Tag[] | ((p: Tag[]) => Tag[])) => void;
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],
  setTags: (v) => set((s) => ({ tags: typeof v === "function" ? v(s.tags) : v })),
}));
