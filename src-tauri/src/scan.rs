use crate::db::{Clip, DbState};
use chrono::NaiveDateTime;
use regex::Regex;
use std::path::Path;
use walkdir::WalkDir;

pub fn get_watch_dirs(db: &DbState) -> Vec<String> {
    if let Ok(Some(json)) = db.get_meta("watch_dirs") {
        if let Ok(dirs) = serde_json::from_str::<Vec<String>>(&json) {
            if !dirs.is_empty() { return dirs; }
        }
    }
    // fallback: default videos dir
    dirs::video_dir()
        .map(|p| vec![p.to_string_lossy().to_string()])
        .unwrap_or_default()
}

// parse timestamp from filename like "2026-01-28 18-40-28.mp4" or "2026-02-17_14-36-20.mp4"
fn parse_timestamp(filename: &str) -> Option<i64> {
    let stem = filename.strip_suffix(".mp4")?;
    let normalized = stem.replace('_', " ");
    let dt = NaiveDateTime::parse_from_str(&normalized, "%Y-%m-%d %H-%M-%S").ok()?;
    Some(dt.and_utc().timestamp())
}

pub fn scan_dirs(db: &DbState) -> Result<Vec<Clip>, String> {
    let re = Regex::new(r"^\d{4}-\d{2}-\d{2}[_ ]\d{2}-\d{2}-\d{2}\.mp4$").unwrap();
    let now = chrono::Utc::now().timestamp();
    let watch_dirs = get_watch_dirs(db);

    let mut seen_paths = std::collections::HashSet::new();

    for dir in &watch_dirs {
        let dir_path = Path::new(dir);
        if !dir_path.exists() { continue; }

        // walk 2 levels deep (picks up immediate files + one subfolder like Captures/)
        for entry in WalkDir::new(dir_path).min_depth(1).max_depth(2) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !entry.file_type().is_file() { continue; }

            let path = entry.path();
            let filename = match path.file_name().and_then(|n| n.to_str()) {
                Some(f) => f,
                None => continue,
            };

            if !re.is_match(filename) { continue; }

            let path_str = path.to_string_lossy().to_string();

            if seen_paths.contains(&path_str) { continue; }
            seen_paths.insert(path_str.clone());

            if db.clip_exists_by_path(&path_str).unwrap_or(false) { continue; }

            let recorded_at = match parse_timestamp(filename) {
                Some(ts) => ts,
                None => continue,
            };

            let file_size = entry.metadata().map(|m| m.len() as i64).unwrap_or(0);

            // derive source label from parent dir name
            let source = path.parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_lowercase();

            let clip = Clip {
                id: uuid::Uuid::new_v4().to_string(),
                filename: filename.to_string(),
                path: path_str,
                dir_source: source,
                recorded_at,
                file_size,
                duration_secs: None,
                width: None,
                height: None,
                thumb_path: None,
                description: String::new(),
                tags: vec![],
                starred: false,
                created_at: now,
                updated_at: now,
            };

            if let Err(e) = db.insert_clip(&clip) {
                eprintln!("insert clip: {}", e);
            }
        }
    }

    // orphan detection: remove clips whose files no longer exist
    let all = db.get_all_clips()?;
    let orphans: Vec<String> = all.iter()
        .filter(|c| !Path::new(&c.path).exists())
        .map(|c| c.id.clone())
        .collect();
    if !orphans.is_empty() {
        eprintln!("removing {} orphaned clips", orphans.len());
        db.delete_clips(&orphans)?;
    }

    db.get_all_clips()
}
