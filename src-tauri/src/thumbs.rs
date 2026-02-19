use crate::db::DbState;
use crate::ffmpeg;
use std::path::PathBuf;

// generate thumbnail for a single clip using ffmpeg
pub fn gen_thumb(
    db: &DbState,
    clip_id: &str,
    video_path: &str,
    thumbs_dir: &PathBuf,
    ffmpeg_path: &str,
) -> Result<String, String> {
    let thumb_filename = format!("{}.jpg", clip_id);
    let thumb_path = thumbs_dir.join(&thumb_filename);
    let thumb_str = thumb_path.to_string_lossy().to_string();

    // extract frame at 2s
    let output = ffmpeg::cmd(ffmpeg_path)
        .args([
            "-y",
            "-ss", "2",
            "-i", video_path,
            "-frames:v", "1",
            "-vf", "scale=320:-1",
            "-q:v", "3",
            &thumb_str,
        ])
        .output()
        .map_err(|e| format!("ffmpeg: {}", e))?;

    if !output.status.success() {
        // try at 0s if 2s fails (short clips)
        let output2 = ffmpeg::cmd(ffmpeg_path)
            .args([
                "-y",
                "-ss", "0",
                "-i", video_path,
                "-frames:v", "1",
                "-vf", "scale=320:-1",
                "-q:v", "3",
                &thumb_str,
            ])
            .output()
            .map_err(|e| format!("ffmpeg retry: {}", e))?;

        if !output2.status.success() {
            return Err("ffmpeg failed to extract frame".into());
        }
    }

    db.update_clip_thumb(clip_id, &thumb_str)?;
    Ok(thumb_str)
}

// probe video metadata using ffprobe
pub fn probe_meta(video_path: &str, ffprobe_path: &str) -> Result<(f64, i32, i32), String> {
    let output = ffmpeg::cmd(ffprobe_path)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path,
        ])
        .output()
        .map_err(|e| format!("ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("ffprobe failed".into());
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("parse ffprobe: {}", e))?;

    // get duration from format
    let duration = json["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    // get resolution from first video stream
    let streams = json["streams"].as_array();
    let (mut width, mut height) = (0i32, 0i32);
    if let Some(streams) = streams {
        for stream in streams {
            if stream["codec_type"].as_str() == Some("video") {
                width = stream["width"].as_i64().unwrap_or(0) as i32;
                height = stream["height"].as_i64().unwrap_or(0) as i32;
                break;
            }
        }
    }

    Ok((duration, width, height))
}
