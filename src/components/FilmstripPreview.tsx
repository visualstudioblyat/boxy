import { memo, useRef, useEffect, useState, useCallback } from "react";
import { localUrl } from "../utils";

interface Props {
  videoPath: string;
  visible: boolean;
  mouseX: number; // 0-1 proportion across the thumbnail
}

export default memo(function FilmstripPreview({ videoPath, visible, mouseX }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const seekTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSeek = useRef(0);

  const src = localUrl(videoPath);

  // load video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible) return;
    setReady(false);
    video.src = src;
    video.load();
    const onMeta = () => setReady(true);
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.src = "";
    };
  }, [src, visible]);

  // seek + paint on mouse move (debounced ~60ms)
  const seekAndPaint = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready || video.duration === 0) return;

    const time = Math.max(0, Math.min(video.duration, mouseX * video.duration));
    // avoid re-seeking to same spot
    if (Math.abs(time - lastSeek.current) < 0.05) return;
    lastSeek.current = time;

    if (video.fastSeek) {
      video.fastSeek(time);
    } else {
      video.currentTime = time;
    }

    const onSeeked = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
  }, [mouseX, ready]);

  useEffect(() => {
    if (!visible || !ready) return;
    clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(seekAndPaint, 60);
    return () => clearTimeout(seekTimer.current);
  }, [visible, ready, seekAndPaint]);

  if (!visible) return null;

  return (
    <>
      <video ref={videoRef} style={{ display: "none" }} preload="metadata" muted />
      <canvas ref={canvasRef} className="filmstrip-canvas" />
      <div className="filmstrip-bar" style={{ width: `${mouseX * 100}%` }} />
    </>
  );
});
