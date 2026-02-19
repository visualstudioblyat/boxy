mod db;
mod scan;
mod thumbs;
mod search;
mod watcher;
mod ffmpeg;
mod editing;

use db::{Clip, Collection, DbState, SmartFolder, Tag};
use search::SearchResult;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

// -- state --

struct AppState {
    db: DbState,
    #[allow(dead_code)]
    app_dir: PathBuf,
    thumbs_dir: PathBuf,
    ffmpeg_path: String,
    ffprobe_path: String,
}

// -- commands --

#[tauri::command]
async fn scan_clips(state: tauri::State<'_, AppState>) -> Result<Vec<Clip>, String> {
    scan::scan_dirs(&state.db)
}

#[tauri::command]
async fn get_clips(state: tauri::State<'_, AppState>) -> Result<Vec<Clip>, String> {
    state.db.get_all_clips()
}

#[tauri::command]
async fn get_tags(state: tauri::State<'_, AppState>) -> Result<Vec<Tag>, String> {
    state.db.get_all_tags()
}

#[tauri::command]
async fn create_tag(state: tauri::State<'_, AppState>, name: String, color: String) -> Result<Tag, String> {
    let id = uuid::Uuid::new_v4().to_string();
    state.db.create_tag(&id, &name, &color)
}

#[tauri::command]
async fn delete_tag(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_tag(&id)
}

#[tauri::command]
async fn add_tag(state: tauri::State<'_, AppState>, clip_id: String, tag_id: String) -> Result<(), String> {
    state.db.add_clip_tag(&clip_id, &tag_id)
}

#[tauri::command]
async fn remove_tag(state: tauri::State<'_, AppState>, clip_id: String, tag_id: String) -> Result<(), String> {
    state.db.remove_clip_tag(&clip_id, &tag_id)
}

#[tauri::command]
async fn update_description(state: tauri::State<'_, AppState>, clip_id: String, desc: String) -> Result<(), String> {
    state.db.update_description(&clip_id, &desc)?;

    // re-embed if description is not empty
    if !desc.trim().is_empty() {
        let vec = simple_embed(&desc);
        let bytes = search::vec_to_bytes(&vec);
        state.db.upsert_embedding(&clip_id, &bytes)?;
    }

    Ok(())
}

#[tauri::command]
async fn gen_thumb(state: tauri::State<'_, AppState>, clip_id: String, video_path: String) -> Result<String, String> {
    thumbs::gen_thumb(&state.db, &clip_id, &video_path, &state.thumbs_dir, &state.ffmpeg_path)
}

#[tauri::command]
async fn gen_all_thumbs(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let clips = state.db.get_all_clips()?;
    let total = clips.len();
    let mut done = 0;

    let _ = app.emit("scan-progress", serde_json::json!({
        "total": total, "done": 0, "phase": "thumbnails"
    }));

    for clip in &clips {
        if clip.thumb_path.is_some() {
            done += 1;
            continue;
        }

        match thumbs::gen_thumb(&state.db, &clip.id, &clip.path, &state.thumbs_dir, &state.ffmpeg_path) {
            Ok(thumb_path) => {
                let _ = app.emit("thumb-ready", serde_json::json!({
                    "clipId": clip.id, "thumbPath": thumb_path
                }));
            }
            Err(e) => eprintln!("thumb {}: {}", clip.filename, e),
        }

        if clip.duration_secs.is_none() {
            if let Ok((dur, w, h)) = thumbs::probe_meta(&clip.path, &state.ffprobe_path) {
                let _ = state.db.update_clip_meta(&clip.id, dur, w, h);
            }
        }

        done += 1;
        if done % 10 == 0 {
            let _ = app.emit("scan-progress", serde_json::json!({
                "total": total, "done": done, "phase": "thumbnails"
            }));
        }
    }

    let _ = app.emit("scan-progress", serde_json::json!({
        "total": total, "done": total, "phase": "complete"
    }));

    Ok(())
}

#[tauri::command]
async fn semantic_search(state: tauri::State<'_, AppState>, query: String, limit: usize) -> Result<Vec<SearchResult>, String> {
    let query_vec = simple_embed(&query);
    search::search(&state.db, &query_vec, limit)
}

#[tauri::command]
async fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_star(state: tauri::State<'_, AppState>, clip_id: String, starred: bool) -> Result<(), String> {
    state.db.toggle_star(&clip_id, starred)
}

#[tauri::command]
async fn bulk_add_tag(state: tauri::State<'_, AppState>, clip_ids: Vec<String>, tag_id: String) -> Result<(), String> {
    state.db.bulk_add_tag(&clip_ids, &tag_id)
}

#[tauri::command]
async fn bulk_remove_tag(state: tauri::State<'_, AppState>, clip_ids: Vec<String>, tag_id: String) -> Result<(), String> {
    state.db.bulk_remove_tag(&clip_ids, &tag_id)
}

#[tauri::command]
async fn bulk_star(state: tauri::State<'_, AppState>, clip_ids: Vec<String>, starred: bool) -> Result<(), String> {
    state.db.bulk_star(&clip_ids, starred)
}

#[tauri::command]
async fn get_collections(state: tauri::State<'_, AppState>) -> Result<Vec<Collection>, String> {
    state.db.get_all_collections()
}

#[tauri::command]
async fn create_collection(state: tauri::State<'_, AppState>, name: String, color: String) -> Result<Collection, String> {
    let id = uuid::Uuid::new_v4().to_string();
    state.db.create_collection(&id, &name, &color)
}

#[tauri::command]
async fn delete_collection(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_collection(&id)
}

#[tauri::command]
async fn add_to_collection(state: tauri::State<'_, AppState>, collection_id: String, clip_ids: Vec<String>) -> Result<(), String> {
    state.db.add_clips_to_collection(&collection_id, &clip_ids)
}

#[tauri::command]
async fn remove_from_collection(state: tauri::State<'_, AppState>, collection_id: String, clip_ids: Vec<String>) -> Result<(), String> {
    state.db.remove_clips_from_collection(&collection_id, &clip_ids)
}

#[tauri::command]
async fn get_collection_clips(state: tauri::State<'_, AppState>, collection_id: String) -> Result<Vec<String>, String> {
    state.db.get_collection_clip_ids(&collection_id)
}

#[tauri::command]
async fn get_smart_folders(state: tauri::State<'_, AppState>) -> Result<Vec<SmartFolder>, String> {
    state.db.get_all_smart_folders()
}

#[tauri::command]
async fn create_smart_folder(state: tauri::State<'_, AppState>, name: String, color: String, rules: String) -> Result<SmartFolder, String> {
    let id = uuid::Uuid::new_v4().to_string();
    state.db.create_smart_folder(&id, &name, &color, &rules)
}

#[tauri::command]
async fn update_smart_folder(state: tauri::State<'_, AppState>, id: String, name: String, color: String, rules: String) -> Result<(), String> {
    state.db.update_smart_folder(&id, &name, &color, &rules)
}

#[tauri::command]
async fn delete_smart_folder(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_smart_folder(&id)
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let dirs = scan::get_watch_dirs(&state.db);
    Ok(serde_json::json!({ "watchDirs": dirs }))
}

#[tauri::command]
async fn set_watch_dirs(state: tauri::State<'_, AppState>, dirs: Vec<String>) -> Result<(), String> {
    let json = serde_json::to_string(&dirs).map_err(|e| e.to_string())?;
    state.db.set_meta("watch_dirs", &json)
}

#[tauri::command]
async fn delete_clips(state: tauri::State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    state.db.delete_clips(&ids)
}

#[tauri::command]
async fn check_ffmpeg(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let out = std::process::Command::new(&state.ffmpeg_path)
        .arg("-version")
        .output();
    Ok(out.map(|o| o.status.success()).unwrap_or(false))
}

#[tauri::command]
async fn probe_clip(state: tauri::State<'_, AppState>, clip_id: String, video_path: String) -> Result<serde_json::Value, String> {
    let (dur, w, h) = thumbs::probe_meta(&video_path, &state.ffprobe_path)?;
    state.db.update_clip_meta(&clip_id, dur, w, h)?;
    Ok(serde_json::json!({ "durationSecs": dur, "width": w, "height": h }))
}

#[tauri::command]
async fn trim_clip(state: tauri::State<'_, AppState>, input: String, output: String, start: f64, end: f64, precise: bool) -> Result<(), String> {
    editing::trim_clip(&state.ffmpeg_path, &input, &output, start, end, precise)
}

#[tauri::command]
async fn merge_clips(state: tauri::State<'_, AppState>, inputs: Vec<String>, output: String) -> Result<(), String> {
    editing::merge_clips(&state.ffmpeg_path, &inputs, &output)
}

#[tauri::command]
async fn export_gif(state: tauri::State<'_, AppState>, input: String, output: String, start: f64, end: f64, width: u32, fps: u32) -> Result<(), String> {
    editing::export_gif(&state.ffmpeg_path, &input, &output, start, end, width, fps)
}

#[tauri::command]
async fn capture_frame(state: tauri::State<'_, AppState>, input: String, output: String, timestamp: f64) -> Result<(), String> {
    editing::capture_frame(&state.ffmpeg_path, &input, &output, timestamp)
}

#[tauri::command]
async fn compress_clip(state: tauri::State<'_, AppState>, input: String, output: String, quality: String, max_width: Option<u32>) -> Result<(), String> {
    editing::compress_clip(&state.ffmpeg_path, &input, &output, &quality, max_width)
}

#[tauri::command]
async fn get_waveform(state: tauri::State<'_, AppState>, clip_id: String, video_path: String) -> Result<Vec<f32>, String> {
    // check cache first
    if let Ok(Some(data)) = state.db.get_waveform(&clip_id) {
        let samples: Vec<f32> = data
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        return Ok(samples);
    }
    let bars = editing::generate_waveform(&state.ffmpeg_path, &video_path, 200)?;
    // cache
    let bytes: Vec<u8> = bars.iter().flat_map(|f| f.to_le_bytes()).collect();
    let _ = state.db.save_waveform(&clip_id, &bytes, bars.len() as i32);
    Ok(bars)
}

// -- simple embedding (bag-of-words cosine similarity placeholder) --
fn simple_embed(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0f32; 384];
    let lower = text.to_lowercase();
    for word in lower.split_whitespace() {
        let mut h = 0u64;
        for b in word.bytes() {
            h = h.wrapping_mul(31).wrapping_add(b as u64);
        }
        let idx = (h % 384) as usize;
        vec[idx] += 1.0;

        if word.len() >= 2 {
            for pair in word.as_bytes().windows(2) {
                let h2 = (pair[0] as u64).wrapping_mul(31).wrapping_add(pair[1] as u64);
                let idx2 = (h2 % 384) as usize;
                vec[idx2] += 0.5;
            }
        }
    }

    let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in vec.iter_mut() {
            *v /= norm;
        }
    }

    vec
}

// -- find ffmpeg --

fn find_ffmpeg() -> (String, String) {
    // check PATH first
    if let Ok(output) = std::process::Command::new("ffmpeg").arg("-version").output() {
        if output.status.success() {
            return ("ffmpeg".to_string(), "ffprobe".to_string());
        }
    }

    // check common install locations
    let mut search_dirs = vec![
        r"C:\ffmpeg\bin".to_string(),
        r"C:\Program Files\ffmpeg\bin".to_string(),
        r"C:\tools\ffmpeg\bin".to_string(),
    ];

    // check winget install location
    if let Some(local) = dirs::data_local_dir() {
        let winget_base = local.join("Microsoft").join("WinGet").join("Packages");
        if winget_base.exists() {
            if let Ok(entries) = std::fs::read_dir(&winget_base) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.contains("FFmpeg") {
                        // walk into subdirs to find bin/ffmpeg.exe
                        for sub in walkdir::WalkDir::new(entry.path()).max_depth(3) {
                            if let Ok(sub) = sub {
                                if sub.file_name() == "ffmpeg.exe" {
                                    if let Some(parent) = sub.path().parent() {
                                        search_dirs.push(parent.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for dir in &search_dirs {
        let ffmpeg = format!("{}\\ffmpeg.exe", dir);
        let ffprobe = format!("{}\\ffprobe.exe", dir);
        if std::path::Path::new(&ffmpeg).exists() {
            eprintln!("found ffmpeg at: {}", ffmpeg);
            return (ffmpeg, ffprobe);
        }
    }

    // fallback
    ("ffmpeg".to_string(), "ffprobe".to_string())
}

// -- run --

pub fn run() {
    let (ffmpeg_path, ffprobe_path) = find_ffmpeg();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .register_uri_scheme_protocol("localfile", |_ctx, req| {
            use std::io::{Read, Seek};
            use tauri::http::Response;

            let uri = req.uri().to_string();

            // strip all possible prefixes
            let path = uri
                .strip_prefix("http://localfile.localhost/")
                .or_else(|| uri.strip_prefix("https://localfile.localhost/"))
                .or_else(|| uri.strip_prefix("localfile://localhost/"))
                .or_else(|| uri.strip_prefix("localfile:///"))
                .or_else(|| uri.strip_prefix("localfile://"))
                .unwrap_or(&uri);

            let decoded = percent_decode(path);
            let file_path = std::path::Path::new(&decoded);

            if !file_path.exists() {
                return Response::builder().status(404).body(Vec::new()).unwrap();
            }

            let mime = if decoded.ends_with(".jpg") || decoded.ends_with(".jpeg") {
                "image/jpeg"
            } else if decoded.ends_with(".png") {
                "image/png"
            } else if decoded.ends_with(".mp4") {
                "video/mp4"
            } else {
                "application/octet-stream"
            };

            let file_size = match std::fs::metadata(file_path) {
                Ok(m) => m.len(),
                Err(_) => return Response::builder().status(500).body(Vec::new()).unwrap(),
            };

            // parse Range header for partial content
            let range = req.headers().get("range")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| parse_range(s, file_size));

            if let Some((start, end)) = range {
                let len = end - start + 1;
                let mut file = match std::fs::File::open(file_path) {
                    Ok(f) => f,
                    Err(_) => return Response::builder().status(500).body(Vec::new()).unwrap(),
                };
                if file.seek(std::io::SeekFrom::Start(start)).is_err() {
                    return Response::builder().status(500).body(Vec::new()).unwrap();
                }
                let mut buf = vec![0u8; len as usize];
                if file.read_exact(&mut buf).is_err() {
                    // partial read ok for end of file
                    let mut buf2 = Vec::new();
                    let _ = std::fs::File::open(file_path)
                        .and_then(|mut f| { f.seek(std::io::SeekFrom::Start(start))?; f.read_to_end(&mut buf2) });
                    buf = buf2;
                }
                Response::builder()
                    .status(206)
                    .header("Content-Type", mime)
                    .header("Content-Range", format!("bytes {}-{}/{}", start, start + buf.len() as u64 - 1, file_size))
                    .header("Accept-Ranges", "bytes")
                    .header("Content-Length", buf.len().to_string())
                    .header("Access-Control-Allow-Origin", "*")
                    .body(buf)
                    .unwrap()
            } else {
                // full read (thumbnails, small files)
                match std::fs::read(file_path) {
                    Ok(data) => {
                        Response::builder()
                            .status(200)
                            .header("Content-Type", mime)
                            .header("Accept-Ranges", "bytes")
                            .header("Content-Length", data.len().to_string())
                            .header("Access-Control-Allow-Origin", "*")
                            .body(data)
                            .unwrap()
                    }
                    Err(_) => Response::builder().status(500).body(Vec::new()).unwrap(),
                }
            }
        })
        .setup(move |app| {
            let app_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("com.bushido.boxy");
            std::fs::create_dir_all(&app_dir).ok();

            let thumbs_dir = app_dir.join("thumbs");
            std::fs::create_dir_all(&thumbs_dir).ok();

            let db = DbState::new(app_dir.join("boxy.db"))
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            db.init().map_err(|e| Box::<dyn std::error::Error>::from(e))?;

            // spawn file watcher before moving db into state
            watcher::spawn(app.handle().clone(), db.clone());

            app.manage(AppState {
                db,
                app_dir,
                thumbs_dir,
                ffmpeg_path: ffmpeg_path.clone(),
                ffprobe_path: ffprobe_path.clone(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_clips,
            get_clips,
            get_tags,
            create_tag,
            delete_tag,
            add_tag,
            remove_tag,
            update_description,
            gen_thumb,
            gen_all_thumbs,
            semantic_search,
            open_in_explorer,
            check_ffmpeg,
            probe_clip,
            get_settings,
            set_watch_dirs,
            delete_clips,
            toggle_star,
            bulk_add_tag,
            bulk_remove_tag,
            bulk_star,
            get_collections,
            create_collection,
            delete_collection,
            add_to_collection,
            remove_from_collection,
            get_collection_clips,
            get_smart_folders,
            create_smart_folder,
            update_smart_folder,
            delete_smart_folder,
            trim_clip,
            merge_clips,
            export_gif,
            capture_frame,
            compress_clip,
            get_waveform,
        ])
        .run(tauri::generate_context!())
        .expect("error running boxy");
}

fn parse_range(header: &str, file_size: u64) -> Option<(u64, u64)> {
    let s = header.strip_prefix("bytes=")?;
    let mut parts = s.splitn(2, '-');
    let start: u64 = parts.next()?.parse().ok()?;
    let end: u64 = parts.next()
        .and_then(|s| if s.is_empty() { None } else { s.parse().ok() })
        .unwrap_or(file_size - 1)
        .min(file_size - 1);
    if start > end { return None; }
    Some((start, end))
}

fn percent_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}
