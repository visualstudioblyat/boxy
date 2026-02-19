// convert a local file path to a localfile:// url for the custom protocol
export const localUrl = (path: string) => {
  // normalize backslashes and encode
  const normalized = path.replace(/\\/g, "/");
  return `http://localfile.localhost/${encodeURIComponent(normalized).replace(/%2F/g, "/")}`;
};

export const fmtDuration = (secs: number | null) => {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const fmtDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

import type { Clip, SmartFolderRule } from "./types";

export const evaluateSmartFolder = (clips: Clip[], rules: SmartFolderRule[]): Clip[] => {
  return clips.filter((clip) => rules.every((rule) => matchRule(clip, rule)));
};

const matchRule = (clip: Clip, rule: SmartFolderRule): boolean => {
  switch (rule.field) {
    case "starred":
      return rule.operator === "is" && clip.starred === Boolean(rule.value);
    case "filename":
      if (rule.operator === "contains") return clip.filename.toLowerCase().includes(String(rule.value).toLowerCase());
      if (rule.operator === "equals") return clip.filename.toLowerCase() === String(rule.value).toLowerCase();
      return false;
    case "dirSource":
      if (rule.operator === "equals") return clip.dirSource.toLowerCase() === String(rule.value).toLowerCase();
      return false;
    case "fileSize": {
      const v = Number(rule.value);
      if (rule.operator === "gt") return clip.fileSize > v;
      if (rule.operator === "lt") return clip.fileSize < v;
      if (rule.operator === "between") return clip.fileSize >= v && clip.fileSize <= Number(rule.value2 ?? v);
      return false;
    }
    case "durationSecs": {
      if (clip.durationSecs == null) return false;
      const v = Number(rule.value);
      if (rule.operator === "gt") return clip.durationSecs > v;
      if (rule.operator === "lt") return clip.durationSecs < v;
      if (rule.operator === "between") return clip.durationSecs >= v && clip.durationSecs <= Number(rule.value2 ?? v);
      return false;
    }
    case "recordedAt": {
      const v = Number(rule.value);
      if (rule.operator === "gt") return clip.recordedAt > v;
      if (rule.operator === "lt") return clip.recordedAt < v;
      return false;
    }
    case "tag":
      if (rule.operator === "has") return clip.tags.includes(String(rule.value));
      return false;
    default:
      return true;
  }
};
