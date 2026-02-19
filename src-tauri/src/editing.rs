use crate::ffmpeg;

/// Trim/cut a clip. Uses stream copy by default (fast), re-encode when `precise` is true.
pub fn trim_clip(
    ffmpeg_path: &str,
    input: &str,
    output: &str,
    start: f64,
    end: f64,
    precise: bool,
) -> Result<(), String> {
    let duration = end - start;
    let start_s = format!("{:.3}", start);
    let dur_s = format!("{:.3}", duration);

    let mut args = vec!["-y", "-ss", &start_s, "-i", input, "-t", &dur_s];

    if precise {
        args.extend_from_slice(&["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac"]);
    } else {
        args.extend_from_slice(&["-c", "copy", "-avoid_negative_ts", "make_zero"]);
    }

    args.push(output);

    let out = ffmpeg::cmd(ffmpeg_path)
        .args(&args)
        .output()
        .map_err(|e| format!("ffmpeg trim: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("ffmpeg trim failed: {}", stderr.chars().take(500).collect::<String>()));
    }
    Ok(())
}

/// Merge clips using concat demuxer (stream copy). Falls back to re-encode on failure.
pub fn merge_clips(
    ffmpeg_path: &str,
    inputs: &[String],
    output: &str,
) -> Result<(), String> {
    // write concat list to temp file
    let tmp = std::env::temp_dir().join("boxy_concat.txt");
    let content: String = inputs
        .iter()
        .map(|p| format!("file '{}'", p.replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(&tmp, &content).map_err(|e| format!("write concat list: {}", e))?;
    let tmp_str = tmp.to_string_lossy().to_string();

    // try stream copy first
    let out = ffmpeg::cmd(ffmpeg_path)
        .args(["-y", "-f", "concat", "-safe", "0", "-i", &tmp_str, "-c", "copy", output])
        .output()
        .map_err(|e| format!("ffmpeg merge: {}", e))?;

    if !out.status.success() {
        // fallback: re-encode
        let out2 = ffmpeg::cmd(ffmpeg_path)
            .args(["-y", "-f", "concat", "-safe", "0", "-i", &tmp_str,
                   "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-c:a", "aac", output])
            .output()
            .map_err(|e| format!("ffmpeg merge re-encode: {}", e))?;

        if !out2.status.success() {
            let stderr = String::from_utf8_lossy(&out2.stderr);
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("merge failed: {}", stderr.chars().take(500).collect::<String>()));
        }
    }

    let _ = std::fs::remove_file(&tmp);
    Ok(())
}

/// Export GIF using two-pass palettegen+paletteuse.
pub fn export_gif(
    ffmpeg_path: &str,
    input: &str,
    output: &str,
    start: f64,
    end: f64,
    width: u32,
    fps: u32,
) -> Result<(), String> {
    let start_s = format!("{:.3}", start);
    let dur_s = format!("{:.3}", end - start);
    let palette = std::env::temp_dir().join("boxy_palette.png");
    let palette_str = palette.to_string_lossy().to_string();
    let filter = format!("fps={},scale={}:-1:flags=lanczos", fps, width);

    // pass 1: generate palette
    let out1 = ffmpeg::cmd(ffmpeg_path)
        .args(["-y", "-ss", &start_s, "-t", &dur_s, "-i", input,
               "-vf", &format!("{},palettegen", filter),
               &palette_str])
        .output()
        .map_err(|e| format!("gif palettegen: {}", e))?;

    if !out1.status.success() {
        let stderr = String::from_utf8_lossy(&out1.stderr);
        return Err(format!("gif palette failed: {}", stderr.chars().take(300).collect::<String>()));
    }

    // pass 2: apply palette
    let filter2 = format!("{} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5", filter);
    let out2 = ffmpeg::cmd(ffmpeg_path)
        .args(["-y", "-ss", &start_s, "-t", &dur_s, "-i", input,
               "-i", &palette_str,
               "-lavfi", &filter2,
               output])
        .output()
        .map_err(|e| format!("gif paletteuse: {}", e))?;

    let _ = std::fs::remove_file(&palette);

    if !out2.status.success() {
        let stderr = String::from_utf8_lossy(&out2.stderr);
        return Err(format!("gif export failed: {}", stderr.chars().take(300).collect::<String>()));
    }
    Ok(())
}

/// Capture a single frame as PNG.
pub fn capture_frame(
    ffmpeg_path: &str,
    input: &str,
    output: &str,
    timestamp: f64,
) -> Result<(), String> {
    let ts = format!("{:.3}", timestamp);
    let out = ffmpeg::cmd(ffmpeg_path)
        .args(["-y", "-ss", &ts, "-i", input, "-frames:v", "1", "-q:v", "1", output])
        .output()
        .map_err(|e| format!("frame capture: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("frame capture failed: {}", stderr.chars().take(300).collect::<String>()));
    }
    Ok(())
}

/// Compress clip with quality presets.
pub fn compress_clip(
    ffmpeg_path: &str,
    input: &str,
    output: &str,
    quality: &str,
    max_width: Option<u32>,
) -> Result<(), String> {
    let (crf, preset) = match quality {
        "high" => ("22", "medium"),
        "medium" => ("28", "fast"),
        "low" => ("34", "fast"),
        _ => ("28", "fast"),
    };

    let vf = match max_width {
        Some(w) => format!("scale='min({},iw)':-2", w),
        None => match quality {
            "low" => "scale='min(1280,iw)':-2".to_string(),
            "medium" => "scale='min(1920,iw)':-2".to_string(),
            _ => String::new(),
        },
    };

    let mut args = vec!["-y", "-i", input, "-c:v", "libx264", "-preset", preset, "-crf", crf, "-c:a", "aac"];
    if !vf.is_empty() {
        args.extend_from_slice(&["-vf", &vf]);
    }
    args.push(output);

    let out = ffmpeg::cmd(ffmpeg_path)
        .args(&args)
        .output()
        .map_err(|e| format!("compress: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("compress failed: {}", stderr.chars().take(500).collect::<String>()));
    }
    Ok(())
}

/// Generate waveform data from audio stream.
pub fn generate_waveform(
    ffmpeg_path: &str,
    input: &str,
    num_samples: usize,
) -> Result<Vec<f32>, String> {
    // dump raw f32le audio, mono, 8kHz
    let out = ffmpeg::cmd(ffmpeg_path)
        .args(["-i", input, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"])
        .output()
        .map_err(|e| format!("waveform: {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("waveform failed: {}", stderr.chars().take(300).collect::<String>()));
    }

    let raw = &out.stdout;
    let total_samples = raw.len() / 4;
    if total_samples == 0 {
        return Ok(vec![0.0; num_samples]);
    }

    // read raw f32 samples
    let samples: Vec<f32> = raw
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();

    // downsample to num_samples bars (peak amplitude per bucket)
    let bucket_size = (total_samples as f64 / num_samples as f64).max(1.0);
    let mut bars = Vec::with_capacity(num_samples);
    for i in 0..num_samples {
        let start = (i as f64 * bucket_size) as usize;
        let end = ((i as f64 + 1.0) * bucket_size) as usize;
        let end = end.min(total_samples);
        let peak = samples[start..end]
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);
        bars.push(peak);
    }

    // normalize 0-1
    let max_peak = bars.iter().cloned().fold(0.0f32, f32::max);
    if max_peak > 0.0 {
        for b in bars.iter_mut() {
            *b /= max_peak;
        }
    }

    Ok(bars)
}
