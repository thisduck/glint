import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";

function clock(n: number) {
  return Math.floor(n / 60) + ":" + String(Math.floor(n) % 60).padStart(2, "0");
}
export function VideoPlayer({ video, player, children, mediaLength }) {
  const workspace = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false);
  const [position, seek] = useState(0),
    [nativeDuration, setDuration] = useState(0);
  const duration = nativeDuration || mediaLength;
  const [full, setFull] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const sync = () =>
      setFull(document.fullscreenElement === workspace.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  async function toggle() {
    try {
      if (player.current.paused) await player.current.play();
      else player.current.pause();
    } catch (e) {
      setError(e.message);
    }
  }
  async function expand() {
    try {
      if (full) await document.exitFullscreen();
      else await workspace.current.requestFullscreen();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section ref={workspace} className="video-workspace">
      <div className="mb-2 flex items-center justify-end">
        <button
          className="inline-flex items-center gap-2 font-semibold"
          onClick={expand}
        >
          {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{" "}
          {full ? "Exit full screen" : "Full-screen editor"}
        </button>
      </div>
      <video
        ref={player}
        playsInline
        preload="metadata"
        aria-label="Local recording"
        src={"clip://library/" + video.id}
        className="block w-full cursor-pointer rounded-t-lg bg-black object-contain"
        onClick={toggle}
        onDoubleClick={expand}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => seek(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          if (Number.isFinite(e.currentTarget.duration))
            setDuration(e.currentTarget.duration);
        }}
        onError={() => setError("This local recording could not be played.")}
      />
      <div className="flex items-center gap-3 rounded-b-lg border border-line bg-paper px-3 py-2">
        <button
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={toggle}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="text-xs tabular-nums">{clock(position)}</span>
        <input
          type="range"
          aria-label="Seek recording"
          min={0}
          max={duration || position || 1}
          step="0.01"
          value={position}
          disabled={!duration}
          onChange={(e) => {
            player.current.currentTime = Number(e.target.value);
            seek(Number(e.target.value));
          }}
          className="min-w-0 flex-1 accent-accent"
        />
        <span className="text-xs tabular-nums">
          {duration ? clock(duration) : "—"}
        </span>
        <button
          aria-label={muted ? "Unmute video" : "Mute video"}
          onClick={() => {
            player.current.muted = !muted;
            setMuted(!muted);
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
      {children}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
