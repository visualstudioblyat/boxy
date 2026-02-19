use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clip {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub dir_source: String,
    pub recorded_at: i64,
    pub file_size: i64,
    pub duration_secs: Option<f64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub thumb_path: Option<String>,
    pub description: String,
    pub tags: Vec<String>,
    pub starred: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub sort_order: i32,
    pub clip_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolder {
    pub id: String,
    pub name: String,
    pub color: String,
    pub rules: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
    pub clip_count: Option<i64>,
}

#[derive(Clone)]
pub struct DbState {
    conn: Arc<Mutex<Connection>>,
}

impl DbState {
    pub fn new(path: PathBuf) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    pub fn init(&self) -> Result<(), String> {
        let conn = self.conn.lock();

        // bootstrap app_meta first (needed for version tracking)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );"
        ).map_err(|e| e.to_string())?;

        let version: i64 = conn.query_row(
            "SELECT value FROM app_meta WHERE key = 'schema_version'",
            [],
            |row| row.get::<_, String>(0),
        ).optional().map_err(|e| e.to_string())?
         .and_then(|v| v.parse().ok())
         .unwrap_or(0);

        if version < 1 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS clips (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    dir_source TEXT NOT NULL,
                    recorded_at INTEGER NOT NULL,
                    file_size INTEGER NOT NULL,
                    duration_secs REAL,
                    width INTEGER,
                    height INTEGER,
                    thumb_path TEXT,
                    description TEXT DEFAULT '',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_clips_recorded ON clips(recorded_at);
                CREATE INDEX IF NOT EXISTS idx_clips_path ON clips(path);

                CREATE TABLE IF NOT EXISTS tags (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    color TEXT DEFAULT '#6366f1',
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS clip_tags (
                    clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
                    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (clip_id, tag_id)
                );
                CREATE INDEX IF NOT EXISTS idx_ct_clip ON clip_tags(clip_id);
                CREATE INDEX IF NOT EXISTS idx_ct_tag ON clip_tags(tag_id);

                CREATE TABLE IF NOT EXISTS embeddings (
                    clip_id TEXT PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
                    vector BLOB NOT NULL,
                    model_version TEXT NOT NULL DEFAULT 'minilm-v6',
                    updated_at INTEGER NOT NULL
                );"
            ).map_err(|e| e.to_string())?;
        }

        if version < 2 {
            conn.execute_batch(
                "ALTER TABLE clips ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS collections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    color TEXT DEFAULT '#6366f1',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS collection_clips (
                    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                    clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    added_at INTEGER NOT NULL,
                    PRIMARY KEY (collection_id, clip_id)
                );
                CREATE INDEX IF NOT EXISTS idx_cc_collection ON collection_clips(collection_id);
                CREATE INDEX IF NOT EXISTS idx_cc_clip ON collection_clips(clip_id);

                CREATE TABLE IF NOT EXISTS smart_folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT DEFAULT '#06b6d4',
                    rules TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS waveforms (
                    clip_id TEXT PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
                    samples BLOB NOT NULL,
                    sample_count INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                );"
            ).map_err(|e| e.to_string())?;
        }

        // update schema version
        conn.execute(
            "INSERT INTO app_meta (key, value) VALUES ('schema_version', '2')
             ON CONFLICT(key) DO UPDATE SET value = '2'",
            [],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    // -- clips --

    pub fn insert_clip(&self, clip: &Clip) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT OR IGNORE INTO clips (id, filename, path, dir_source, recorded_at, file_size, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![clip.id, clip.filename, clip.path, clip.dir_source, clip.recorded_at, clip.file_size, clip.description, clip.created_at, clip.updated_at],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all_clips(&self) -> Result<Vec<Clip>, String> {
        let conn = self.conn.lock();

        // bulk load all clip→tag mappings in one query
        let mut tag_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        {
            let mut tag_stmt = conn.prepare("SELECT clip_id, tag_id FROM clip_tags")
                .map_err(|e| e.to_string())?;
            let tag_rows = tag_stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            }).map_err(|e| e.to_string())?;
            for r in tag_rows.flatten() {
                tag_map.entry(r.0).or_default().push(r.1);
            }
        }

        let mut stmt = conn.prepare(
            "SELECT id, filename, path, dir_source, recorded_at, file_size,
                    duration_secs, width, height, thumb_path, description,
                    starred, created_at, updated_at
             FROM clips ORDER BY recorded_at DESC"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            Ok(Clip {
                id,
                filename: row.get(1)?,
                path: row.get(2)?,
                dir_source: row.get(3)?,
                recorded_at: row.get(4)?,
                file_size: row.get(5)?,
                duration_secs: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                thumb_path: row.get(9)?,
                description: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                starred: row.get::<_, i32>(11)? != 0,
                tags: vec![], // filled below
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut clips: Vec<Clip> = rows.flatten().collect();
        for clip in &mut clips {
            if let Some(tags) = tag_map.remove(&clip.id) {
                clip.tags = tags;
            }
        }

        Ok(clips)
    }

    pub fn update_clip_thumb(&self, clip_id: &str, thumb_path: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE clips SET thumb_path = ?1, updated_at = ?2 WHERE id = ?3",
            params![thumb_path, chrono::Utc::now().timestamp(), clip_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_clip_meta(&self, clip_id: &str, duration: f64, width: i32, height: i32) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE clips SET duration_secs = ?1, width = ?2, height = ?3, updated_at = ?4 WHERE id = ?5",
            params![duration, width, height, chrono::Utc::now().timestamp(), clip_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_description(&self, clip_id: &str, desc: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE clips SET description = ?1, updated_at = ?2 WHERE id = ?3",
            params![desc, chrono::Utc::now().timestamp(), clip_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clip_exists_by_path(&self, path: &str) -> Result<bool, String> {
        let conn = self.conn.lock();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM clips WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        Ok(count > 0)
    }

    // -- tags --

    pub fn get_all_tags(&self) -> Result<Vec<Tag>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.name, t.color, t.created_at,
                    (SELECT COUNT(*) FROM clip_tags ct WHERE ct.tag_id = t.id) as clip_count
             FROM tags t ORDER BY t.name"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                clip_count: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn create_tag(&self, id: &str, name: &str, color: &str) -> Result<Tag, String> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, color, now],
        ).map_err(|e| e.to_string())?;
        Ok(Tag { id: id.to_string(), name: name.to_string(), color: color.to_string(), created_at: now, clip_count: Some(0) })
    }

    pub fn delete_tag(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_clip_tag(&self, clip_id: &str, tag_id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT OR IGNORE INTO clip_tags (clip_id, tag_id) VALUES (?1, ?2)",
            params![clip_id, tag_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_clip_tag(&self, clip_id: &str, tag_id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "DELETE FROM clip_tags WHERE clip_id = ?1 AND tag_id = ?2",
            params![clip_id, tag_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_clips(&self, ids: &[String]) -> Result<(), String> {
        let conn = self.conn.lock();
        for id in ids {
            conn.execute("DELETE FROM clips WHERE id = ?1", params![id])
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // -- starred --

    pub fn toggle_star(&self, clip_id: &str, starred: bool) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE clips SET starred = ?1, updated_at = ?2 WHERE id = ?3",
            params![starred as i32, chrono::Utc::now().timestamp(), clip_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // -- bulk operations --

    pub fn bulk_add_tag(&self, clip_ids: &[String], tag_id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        for clip_id in clip_ids {
            conn.execute(
                "INSERT OR IGNORE INTO clip_tags (clip_id, tag_id) VALUES (?1, ?2)",
                params![clip_id, tag_id],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn bulk_remove_tag(&self, clip_ids: &[String], tag_id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        for clip_id in clip_ids {
            conn.execute(
                "DELETE FROM clip_tags WHERE clip_id = ?1 AND tag_id = ?2",
                params![clip_id, tag_id],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn bulk_star(&self, clip_ids: &[String], starred: bool) -> Result<(), String> {
        let conn = self.conn.lock();
        let now = chrono::Utc::now().timestamp();
        conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        for clip_id in clip_ids {
            conn.execute(
                "UPDATE clips SET starred = ?1, updated_at = ?2 WHERE id = ?3",
                params![starred as i32, now, clip_id],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    // -- collections --

    pub fn get_all_collections(&self) -> Result<Vec<Collection>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT c.id, c.name, c.description, c.color, c.sort_order, c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM collection_clips cc WHERE cc.collection_id = c.id) as clip_count
             FROM collections c ORDER BY c.sort_order, c.name"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                color: row.get(3)?,
                sort_order: row.get(4)?,
                clip_count: row.get(7)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn create_collection(&self, id: &str, name: &str, color: &str) -> Result<Collection, String> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO collections (id, name, color, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
            params![id, name, color, now],
        ).map_err(|e| e.to_string())?;
        Ok(Collection { id: id.to_string(), name: name.to_string(), description: String::new(), color: color.to_string(), sort_order: 0, clip_count: 0, created_at: now, updated_at: now })
    }

    pub fn delete_collection(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM collections WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_clips_to_collection(&self, collection_id: &str, clip_ids: &[String]) -> Result<(), String> {
        let conn = self.conn.lock();
        let now = chrono::Utc::now().timestamp();
        conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        for clip_id in clip_ids {
            conn.execute(
                "INSERT OR IGNORE INTO collection_clips (collection_id, clip_id, added_at) VALUES (?1, ?2, ?3)",
                params![collection_id, clip_id, now],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_clips_from_collection(&self, collection_id: &str, clip_ids: &[String]) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        for clip_id in clip_ids {
            conn.execute(
                "DELETE FROM collection_clips WHERE collection_id = ?1 AND clip_id = ?2",
                params![collection_id, clip_id],
            ).map_err(|e| e.to_string())?;
        }
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_collection_clip_ids(&self, collection_id: &str) -> Result<Vec<String>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT clip_id FROM collection_clips WHERE collection_id = ?1 ORDER BY sort_order, added_at"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![collection_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    // -- smart folders --

    pub fn get_all_smart_folders(&self) -> Result<Vec<SmartFolder>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, rules, created_at, updated_at FROM smart_folders ORDER BY name"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(SmartFolder {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                rules: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn create_smart_folder(&self, id: &str, name: &str, color: &str, rules: &str) -> Result<SmartFolder, String> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO smart_folders (id, name, color, rules, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![id, name, color, rules, now],
        ).map_err(|e| e.to_string())?;
        Ok(SmartFolder { id: id.to_string(), name: name.to_string(), color: color.to_string(), rules: rules.to_string(), created_at: now, updated_at: now })
    }

    pub fn update_smart_folder(&self, id: &str, name: &str, color: &str, rules: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE smart_folders SET name = ?1, color = ?2, rules = ?3, updated_at = ?4 WHERE id = ?5",
            params![name, color, rules, chrono::Utc::now().timestamp(), id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_smart_folder(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM smart_folders WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    // -- waveforms --

    pub fn get_waveform(&self, clip_id: &str) -> Result<Option<Vec<u8>>, String> {
        let conn = self.conn.lock();
        conn.query_row(
            "SELECT samples FROM waveforms WHERE clip_id = ?1",
            params![clip_id],
            |row| row.get(0),
        ).optional().map_err(|e| e.to_string())
    }

    pub fn save_waveform(&self, clip_id: &str, samples: &[u8], count: i32) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO waveforms (clip_id, samples, sample_count, created_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(clip_id) DO UPDATE SET samples = ?2, sample_count = ?3, created_at = ?4",
            params![clip_id, samples, count, chrono::Utc::now().timestamp()],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // -- app_meta --

    pub fn get_meta(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock();
        conn.query_row(
            "SELECT value FROM app_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        ).optional().map_err(|e| e.to_string())
    }

    pub fn set_meta(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO app_meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // -- embeddings --

    pub fn upsert_embedding(&self, clip_id: &str, vector: &[u8]) -> Result<(), String> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO embeddings (clip_id, vector, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(clip_id) DO UPDATE SET vector = ?2, updated_at = ?3",
            params![clip_id, vector, chrono::Utc::now().timestamp()],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all_embeddings(&self) -> Result<Vec<(String, Vec<u8>)>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare("SELECT clip_id, vector FROM embeddings")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
        }).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    #[cfg(test)]
    pub fn in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> DbState {
        let db = DbState::in_memory().unwrap();
        db.init().unwrap();
        db
    }

    fn make_clip(id: &str, path: &str) -> Clip {
        Clip {
            id: id.to_string(),
            filename: format!("{}.mp4", id),
            path: path.to_string(),
            dir_source: "test".to_string(),
            recorded_at: 1700000000,
            file_size: 1024,
            duration_secs: None,
            width: None,
            height: None,
            thumb_path: None,
            description: String::new(),
            tags: vec![],
            starred: false,
            created_at: 1700000000,
            updated_at: 1700000000,
        }
    }

    #[test]
    fn test_init_creates_tables() {
        let db = setup();
        // should be able to call init again without error (idempotent migration)
        db.init().unwrap();
        let version = db.get_meta("schema_version").unwrap();
        assert_eq!(version, Some("2".to_string()));
    }

    #[test]
    fn test_insert_and_get_clip() {
        let db = setup();
        let clip = make_clip("c1", "/test/clip1.mp4");
        db.insert_clip(&clip).unwrap();

        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].id, "c1");
        assert_eq!(clips[0].filename, "c1.mp4");
        assert_eq!(clips[0].path, "/test/clip1.mp4");
    }

    #[test]
    fn test_insert_ignore_duplicate_path() {
        let db = setup();
        let clip = make_clip("c1", "/test/clip1.mp4");
        db.insert_clip(&clip).unwrap();
        // same path, different id - should be ignored
        let clip2 = make_clip("c2", "/test/clip1.mp4");
        db.insert_clip(&clip2).unwrap();

        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips.len(), 1);
    }

    #[test]
    fn test_clip_exists_by_path() {
        let db = setup();
        assert!(!db.clip_exists_by_path("/nope").unwrap());
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        assert!(db.clip_exists_by_path("/test/clip1.mp4").unwrap());
    }

    #[test]
    fn test_update_clip_meta() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.update_clip_meta("c1", 10.5, 1920, 1080).unwrap();

        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips[0].duration_secs, Some(10.5));
        assert_eq!(clips[0].width, Some(1920));
        assert_eq!(clips[0].height, Some(1080));
    }

    #[test]
    fn test_update_description() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.update_description("c1", "cool clip").unwrap();

        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips[0].description, "cool clip");
    }

    #[test]
    fn test_starred() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();

        let clips = db.get_all_clips().unwrap();
        assert!(!clips[0].starred);

        db.toggle_star("c1", true).unwrap();
        let clips = db.get_all_clips().unwrap();
        assert!(clips[0].starred);

        db.toggle_star("c1", false).unwrap();
        let clips = db.get_all_clips().unwrap();
        assert!(!clips[0].starred);
    }

    #[test]
    fn test_tags_crud() {
        let db = setup();
        let tag = db.create_tag("t1", "funny", "#ff0000").unwrap();
        assert_eq!(tag.name, "funny");

        let tags = db.get_all_tags().unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].clip_count, Some(0));

        db.delete_tag("t1").unwrap();
        let tags = db.get_all_tags().unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn test_clip_tags() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.create_tag("t1", "funny", "#ff0000").unwrap();

        db.add_clip_tag("c1", "t1").unwrap();
        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips[0].tags, vec!["t1"]);

        // tag clip count
        let tags = db.get_all_tags().unwrap();
        assert_eq!(tags[0].clip_count, Some(1));

        db.remove_clip_tag("c1", "t1").unwrap();
        let clips = db.get_all_clips().unwrap();
        assert!(clips[0].tags.is_empty());
    }

    #[test]
    fn test_delete_clips() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.insert_clip(&make_clip("c2", "/test/clip2.mp4")).unwrap();

        db.delete_clips(&["c1".to_string()]).unwrap();
        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].id, "c2");
    }

    #[test]
    fn test_bulk_add_tag() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.insert_clip(&make_clip("c2", "/test/clip2.mp4")).unwrap();
        db.create_tag("t1", "action", "#0000ff").unwrap();

        db.bulk_add_tag(&["c1".to_string(), "c2".to_string()], "t1").unwrap();

        let clips = db.get_all_clips().unwrap();
        for clip in &clips {
            assert!(clip.tags.contains(&"t1".to_string()));
        }
    }

    #[test]
    fn test_bulk_remove_tag() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.insert_clip(&make_clip("c2", "/test/clip2.mp4")).unwrap();
        db.create_tag("t1", "action", "#0000ff").unwrap();
        db.bulk_add_tag(&["c1".to_string(), "c2".to_string()], "t1").unwrap();

        db.bulk_remove_tag(&["c1".to_string()], "t1").unwrap();

        let clips = db.get_all_clips().unwrap();
        let c1 = clips.iter().find(|c| c.id == "c1").unwrap();
        let c2 = clips.iter().find(|c| c.id == "c2").unwrap();
        assert!(c1.tags.is_empty());
        assert!(c2.tags.contains(&"t1".to_string()));
    }

    #[test]
    fn test_bulk_star() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.insert_clip(&make_clip("c2", "/test/clip2.mp4")).unwrap();

        db.bulk_star(&["c1".to_string(), "c2".to_string()], true).unwrap();
        let clips = db.get_all_clips().unwrap();
        assert!(clips.iter().all(|c| c.starred));

        db.bulk_star(&["c1".to_string()], false).unwrap();
        let c1 = db.get_all_clips().unwrap().into_iter().find(|c| c.id == "c1").unwrap();
        assert!(!c1.starred);
    }

    #[test]
    fn test_collections_crud() {
        let db = setup();
        let col = db.create_collection("col1", "Highlights", "#ff0000").unwrap();
        assert_eq!(col.name, "Highlights");
        assert_eq!(col.clip_count, 0);

        let cols = db.get_all_collections().unwrap();
        assert_eq!(cols.len(), 1);

        db.delete_collection("col1").unwrap();
        assert!(db.get_all_collections().unwrap().is_empty());
    }

    #[test]
    fn test_collection_clips() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.insert_clip(&make_clip("c2", "/test/clip2.mp4")).unwrap();
        db.create_collection("col1", "Best", "#00ff00").unwrap();

        db.add_clips_to_collection("col1", &["c1".to_string(), "c2".to_string()]).unwrap();
        let ids = db.get_collection_clip_ids("col1").unwrap();
        assert_eq!(ids.len(), 2);

        // clip count
        let cols = db.get_all_collections().unwrap();
        assert_eq!(cols[0].clip_count, 2);

        db.remove_clips_from_collection("col1", &["c1".to_string()]).unwrap();
        let ids = db.get_collection_clip_ids("col1").unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "c2");
    }

    #[test]
    fn test_smart_folders_crud() {
        let db = setup();
        let sf = db.create_smart_folder("sf1", "Big Files", "#06b6d4", r#"[{"field":"fileSize","op":"gt","value":"50000000"}]"#).unwrap();
        assert_eq!(sf.name, "Big Files");

        let folders = db.get_all_smart_folders().unwrap();
        assert_eq!(folders.len(), 1);

        db.update_smart_folder("sf1", "Huge Files", "#ff0000", r#"[{"field":"fileSize","op":"gt","value":"100000000"}]"#).unwrap();
        let folders = db.get_all_smart_folders().unwrap();
        assert_eq!(folders[0].name, "Huge Files");

        db.delete_smart_folder("sf1").unwrap();
        assert!(db.get_all_smart_folders().unwrap().is_empty());
    }

    #[test]
    fn test_waveform_cache() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();

        assert!(db.get_waveform("c1").unwrap().is_none());

        let samples: Vec<u8> = vec![0, 0, 128, 63]; // f32 1.0 in le bytes
        db.save_waveform("c1", &samples, 1).unwrap();

        let cached = db.get_waveform("c1").unwrap().unwrap();
        assert_eq!(cached, samples);

        // upsert overwrites
        let samples2: Vec<u8> = vec![0, 0, 0, 64]; // f32 2.0
        db.save_waveform("c1", &samples2, 1).unwrap();
        let cached = db.get_waveform("c1").unwrap().unwrap();
        assert_eq!(cached, samples2);
    }

    #[test]
    fn test_app_meta() {
        let db = setup();
        assert_eq!(db.get_meta("foo").unwrap(), None);

        db.set_meta("foo", "bar").unwrap();
        assert_eq!(db.get_meta("foo").unwrap(), Some("bar".to_string()));

        db.set_meta("foo", "baz").unwrap();
        assert_eq!(db.get_meta("foo").unwrap(), Some("baz".to_string()));
    }

    #[test]
    fn test_embeddings() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();

        let vec_data = vec![1u8, 2, 3, 4];
        db.upsert_embedding("c1", &vec_data).unwrap();

        let all = db.get_all_embeddings().unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].0, "c1");
        assert_eq!(all[0].1, vec_data);

        // upsert overwrites
        let vec2 = vec![5u8, 6, 7, 8];
        db.upsert_embedding("c1", &vec2).unwrap();
        let all = db.get_all_embeddings().unwrap();
        assert_eq!(all[0].1, vec2);
    }

    #[test]
    fn test_cascade_delete_clip_removes_tags_and_collections() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        db.create_tag("t1", "test", "#000").unwrap();
        db.add_clip_tag("c1", "t1").unwrap();
        db.create_collection("col1", "My Col", "#fff").unwrap();
        db.add_clips_to_collection("col1", &["c1".to_string()]).unwrap();

        // deleting the clip should cascade-remove clip_tags and collection_clips
        db.delete_clips(&["c1".to_string()]).unwrap();

        let tags = db.get_all_tags().unwrap();
        assert_eq!(tags[0].clip_count, Some(0));

        let col_clips = db.get_collection_clip_ids("col1").unwrap();
        assert!(col_clips.is_empty());
    }

    #[test]
    fn test_update_clip_thumb() {
        let db = setup();
        db.insert_clip(&make_clip("c1", "/test/clip1.mp4")).unwrap();
        assert!(db.get_all_clips().unwrap()[0].thumb_path.is_none());

        db.update_clip_thumb("c1", "/thumbs/c1.jpg").unwrap();
        let clips = db.get_all_clips().unwrap();
        assert_eq!(clips[0].thumb_path, Some("/thumbs/c1.jpg".to_string()));
    }
}
