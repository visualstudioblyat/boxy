import { create } from "zustand";
import type { Collection, SmartFolder } from "../types";

interface CollectionState {
  collections: Collection[];
  smartFolders: SmartFolder[];
  activeCollectionId: string | null;
  activeSmartFolderId: string | null;
  activeCollectionClipIds: string[];

  setCollections: (v: Collection[] | ((p: Collection[]) => Collection[])) => void;
  setSmartFolders: (v: SmartFolder[] | ((p: SmartFolder[]) => SmartFolder[])) => void;
  setActiveCollectionId: (v: string | null) => void;
  setActiveSmartFolderId: (v: string | null) => void;
  setActiveCollectionClipIds: (v: string[]) => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  collections: [],
  smartFolders: [],
  activeCollectionId: null,
  activeSmartFolderId: null,
  activeCollectionClipIds: [],

  setCollections: (v) => set((s) => ({ collections: typeof v === "function" ? v(s.collections) : v })),
  setSmartFolders: (v) => set((s) => ({ smartFolders: typeof v === "function" ? v(s.smartFolders) : v })),
  setActiveCollectionId: (v) => set({ activeCollectionId: v, activeSmartFolderId: null }),
  setActiveSmartFolderId: (v) => set({ activeSmartFolderId: v, activeCollectionId: null }),
  setActiveCollectionClipIds: (v) => set({ activeCollectionClipIds: v }),
}));
