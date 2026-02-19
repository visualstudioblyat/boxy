use crate::db::DbState;
use crate::scan;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn spawn(app: AppHandle, db: DbState) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel();

        let mut debouncer = match new_debouncer(Duration::from_secs(2), tx) {
            Ok(d) => d,
            Err(e) => { eprintln!("watcher init: {}", e); return; }
        };

        let dirs = scan::get_watch_dirs(&db);
        for dir in &dirs {
            let p = Path::new(dir);
            if p.exists() {
                if let Err(e) = debouncer.watcher().watch(p, RecursiveMode::Recursive) {
                    eprintln!("watch {}: {}", dir, e);
                }
            }
        }

        eprintln!("file watcher active on {} dirs", dirs.len());

        for events in rx {
            let events = match events {
                Ok(evts) => evts,
                Err(e) => { eprintln!("watcher error: {:?}", e); continue; }
            };

            // check if any event is an mp4 file change
            let has_mp4 = events.iter().any(|e| {
                e.kind == DebouncedEventKind::Any &&
                e.path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("mp4"))
            });

            if has_mp4 {
                eprintln!("watcher: mp4 change detected, rescanning");
                if let Ok(clips) = scan::scan_dirs(&db) {
                    let _ = app.emit("clips-updated", clips.len());
                }
            }
        }
    });
}
