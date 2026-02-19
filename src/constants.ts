import type { ClipFilter, SortConfig } from "./types";

export const DEFAULT_FILTER: ClipFilter = {
  dateFrom: null,
  dateTo: null,
  tags: [],
  search: "",
  dirSource: "all",
  starred: null,
};

export const DEFAULT_SORT: SortConfig = {
  field: "recordedAt",
  dir: "desc",
};

export const SORT_OPTIONS: { label: string; field: SortConfig["field"] }[] = [
  { label: "Date", field: "recordedAt" },
  { label: "Name", field: "filename" },
  { label: "Size", field: "fileSize" },
  { label: "Duration", field: "durationSecs" },
];

export const DIR_SOURCE_COLORS: Record<string, string> = {
  videos: "#6366f1",
  captures: "#ec4899",
  root: "#6366f1",
};

export const DIR_SOURCE_FALLBACK_COLORS = [
  "#22c55e", "#f59e0b", "#06b6d4", "#f43f5e", "#8b5cf6", "#14b8a6",
];

export const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4];

export const TAG_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
];
