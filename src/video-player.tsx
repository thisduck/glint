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
    <section
      ref={workspace}
      aria-label="Recording player"
      className="video-workspace"
    >
      <div className="overflow-hidden rounded-xl border border-line bg-deep">
        <div className="relative">
          <video
            ref={player}
            playsInline
            preload="metadata"
            aria-label="Local recording"
            src={"clip://library/" + video.id}
            className="block w-full cursor-pointer bg-black object-contain"
            onClick={toggle}
            onDoubleClick={expand}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => seek(e.currentTarget.currentTime)}
            onDurationChange={(e) => {
              if (Number.isFinite(e.currentTarget.duration))
                setDuration(e.currentTarget.duration);
            }}
            onError={() =>
              setError("This local recording could not be played.")
            }
          />
          {!playing && !error && (
            <button
              aria-label="Play recording"
              className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-white/30 bg-black/75 p-0 text-white hover:bg-black"
              onClick={toggle}
            >
              <Play
                className="ml-0.5 size-5"
                aria-hidden="true"
                fill="currentColor"
              />
            </button>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 border-t border-line bg-paper px-2 py-1.5 sm:gap-3 sm:px-3">
          <button
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
            className="grid size-9 shrink-0 place-items-center border-0 bg-transparent p-0"
            onClick={toggle}
          >
            {playing ? (
              <Pause size={17} aria-hidden="true" />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
          </button>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {clock(position)} <span aria-hidden="true">/</span>{" "}
            {duration ? clock(duration) : "—"}
          </span>
          <input
            type="range"
            aria-label="Seek recording"
            aria-valuetext={clock(position)}
            min={0}
            max={duration || position || 1}
            step="0.01"
            value={position}
            disabled={!duration}
            onChange={(e) => {
              player.current.currentTime = Number(e.target.value);
              seek(Number(e.target.value));
            }}
            className="h-9 min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 accent-accent"
          />
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
            className="grid size-9 shrink-0 place-items-center border-0 bg-transparent p-0"
            onClick={() => {
              player.current.muted = !muted;
              setMuted(!muted);
            }}
          >
            {muted ? (
              <VolumeX size={17} aria-hidden="true" />
            ) : (
              <Volume2 size={17} aria-hidden="true" />
            )}
          </button>
          <button
            aria-label={full ? "Exit full screen" : "Full-screen editor"}
            title={full ? "Exit full screen" : "Full-screen editor"}
            className="grid size-9 shrink-0 place-items-center border-0 bg-transparent p-0"
            onClick={expand}
          >
            {full ? (
              <Minimize2 size={17} aria-hidden="true" />
            ) : (
              <Maximize2 size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {children}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
