export interface Clip {
  id: string;
  filename: string;
  path: string;
  dirSource: "root" | "captures";
  recordedAt: number;
  fileSize: number;
  durationSecs: number | null;
  width: number | null;
  height: number | null;
  thumbPath: string | null;
  description: string;
  tags: string[];
  starred: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  clipCount?: number;
}

export interface ClipFilter {
  dateFrom: number | null;
  dateTo: number | null;
  tags: string[];
  search: string;
  dirSource: string;
  starred: boolean | null;
}

export type SortField = "recordedAt" | "filename" | "fileSize" | "durationSecs";
export type SortDir = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  dir: SortDir;
}

export type ViewMode = "grid" | "timeline";

export interface SearchResult {
  clipId: string;
  score: number;
}

export interface ScanProgress {
  total: number;
  done: number;
  phase: "scanning" | "thumbnails" | "complete";
}

export interface ClipMeta {
  durationSecs: number;
  width: number;
  height: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
  clipCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SmartFolderRule {
  field: "tag" | "dirSource" | "durationSecs" | "fileSize" | "recordedAt" | "starred" | "filename";
  operator: "contains" | "equals" | "gt" | "lt" | "between" | "has" | "is";
  value: string | number | boolean;
  value2?: number;
}

export interface SmartFolder {
  id: string;
  name: string;
  color: string;
  rules: string;
  createdAt: number;
  updatedAt: number;
}
