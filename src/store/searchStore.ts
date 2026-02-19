import { create } from "zustand";
import type { SearchResult } from "../types";

interface SearchState {
  query: string;
  semanticMode: boolean;
  semanticResults: SearchResult[];
  semanticLoading: boolean;

  setQuery: (v: string) => void;
  setSemanticMode: (v: boolean) => void;
  setSemanticResults: (v: SearchResult[]) => void;
  setSemanticLoading: (v: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  semanticMode: false,
  semanticResults: [],
  semanticLoading: false,

  setQuery: (v) => set({ query: v }),
  setSemanticMode: (v) => set({ semanticMode: v }),
  setSemanticResults: (v) => set({ semanticResults: v }),
  setSemanticLoading: (v) => set({ semanticLoading: v }),
}));
