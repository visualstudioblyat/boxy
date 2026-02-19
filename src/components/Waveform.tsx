import { memo, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  clipId: string;
  videoPath: string;
}

export default memo(function Waveform({ clipId, videoPath }: Props) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBars(null);
    setLoading(true);
    invoke<number[]>("get_waveform", { clipId, videoPath })
      .then(setBars)
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [clipId, videoPath]);

  if (loading) {
    return <div className="waveform-loading">Loading waveform...</div>;
  }

  if (!bars || bars.length === 0) return null;

  const width = 280;
  const height = 48;
  const barWidth = width / bars.length;

  return (
    <svg className="waveform-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {bars.map((v, i) => {
        const barH = Math.max(1, v * height);
        return (
          <rect
            key={i}
            x={i * barWidth}
            y={(height - barH) / 2}
            width={Math.max(0.5, barWidth - 0.5)}
            height={barH}
            rx={0.5}
            fill="var(--accent)"
            opacity={0.5 + v * 0.5}
          />
        );
      })}
    </svg>
  );
});
