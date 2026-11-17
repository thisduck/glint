import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Pause, Play, Scissors } from "lucide-react";

function time(seconds: number) {
  const tenths = Math.round(seconds * 10);
  return (
    Math.floor(tenths / 600) +
    ":" +
    String(Math.floor(tenths / 10) % 60).padStart(2, "0") +
    "." +
    (tenths % 10)
  );
}

type Marker = "start" | "end" | "playhead";
export function ClipEditor({ video, player, busy, onSave }) {
  const [duration, setDuration] = useState((video.durationMs || 0) / 1000);
  const [start, setStart] = useState(0),
    [end, setEnd] = useState<number | null>(null);
  const [position, setPosition] = useState(0),
    [previewing, setPreviewing] = useState(false);
  const [image, setImage] = useState(""),
    [error, setError] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const dragging = useRef<Marker | null>(null);
  const previewEnd = useRef<number | null>(null);
  const out = end ?? duration;

  useEffect(() => {
    let active = true;
    const media = player.current;
    const updateDuration = () => {
      if (
        !video.durationMs &&
        Number.isFinite(media.duration) &&
        media.duration > 0
      )
        setDuration(media.duration);
    };
    updateDuration();
    media.addEventListener("durationchange", updateDuration);
    async function load() {
      try {
        if (!window.desk.filmstrip)
          throw Error("Quit and reopen glint to load timeline frames.");
        const strip = await window.desk.filmstrip(video.id);
        if (active) {
          setDuration(strip.duration);
          setImage(strip.image);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    let frame;
    function sync() {
      if (
        previewEnd.current !== null &&
        media.currentTime >= previewEnd.current
      ) {
        const stop = previewEnd.current;
        previewEnd.current = null;
        media.pause();
        media.currentTime = stop;
      }
      setPosition(media.currentTime);
    }
    function tick() {
      sync();
      if (!media.paused) frame = requestAnimationFrame(tick);
    }
    function playing() {
      cancelAnimationFrame(frame);
      tick();
    }
    function paused() {
      previewEnd.current = null;
      setPreviewing(false);
      cancelAnimationFrame(frame);
      sync();
    }
    media.addEventListener("play", playing);
    media.addEventListener("pause", paused);
    media.addEventListener("timeupdate", sync);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      media.removeEventListener("durationchange", updateDuration);
      media.removeEventListener("play", playing);
      media.removeEventListener("pause", paused);
      media.removeEventListener("timeupdate", sync);
    };
  }, [video.id, player]);

  function move(marker: Marker, seconds: number) {
    if (!duration || busy) return;
    previewEnd.current = null;
    player.current.pause();
    setPreviewing(false);
    const gap = Math.min(0.1, duration);
    let next = Math.max(0, Math.min(duration, seconds));
    if (marker === "start") {
      next = Math.min(out - gap, next);
      setStart(next);
    }
    if (marker === "end") {
      next = Math.max(start + gap, next);
      setEnd(next);
    }
    player.current.currentTime = next;
    setPosition(next);
  }
  function fromPointer(e) {
    const bounds = rail.current.getBoundingClientRect();
    return ((e.clientX - bounds.left) / bounds.width) * duration;
  }
  function keys(event, marker: Marker, value: number) {
    const step = event.shiftKey ? 1 : 0.1;
    const next = {
      ArrowLeft: value - step,
      ArrowRight: value + step,
      Home: 0,
      End: duration,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(marker, next);
  }
  function slider(
    marker: Marker,
    label: string,
    value: number,
    min: number,
    max: number,
  ) {
    return {
      role: "slider",
      tabIndex: busy ? -1 : 0,
      "aria-label": label,
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-valuenow": value,
      "aria-valuetext": time(value),
      onKeyDown: (e) => keys(e, marker, value),
    };
  }
  async function preview() {
    const media = player.current;
    if (previewing) {
      media.pause();
      return;
    }
    media.currentTime = start;
    previewEnd.current = out;
    setPreviewing(true);
    try {
      await media.play();
    } catch (e) {
      previewEnd.current = null;
      setPreviewing(false);
      setError(e.message);
    }
  }
  const percent = (n) =>
    duration ? Math.min(100, Math.max(0, (n / duration) * 100)) + "%" : "0%";
  return (
    <section aria-label="Clip editor" className="destination p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Scissors size={16} /> Trim clip
        </h3>
        {duration > 0 && (
          <span className="text-sm tabular-nums text-muted">
            {time(out - start)} selected
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Drag the edges to set your clip. Click the frames to scrub.
      </p>
      {duration > 0 ? (
        <>
          <div className="mx-2 mt-5">
            <div
              ref={rail}
              className="relative h-14 touch-none select-none rounded bg-deep sm:h-16"
              onPointerDown={(e) => {
                if (busy || e.button !== 0 || !e.isPrimary) return;
                const marker =
                  ((e.target as HTMLElement).closest<HTMLElement>(
                    "[data-marker]",
                  )?.dataset.marker as Marker) || "playhead";
                dragging.current = marker;
                e.currentTarget.setPointerCapture(e.pointerId);
                if (marker === "playhead") move(marker, fromPointer(e));
              }}
              onPointerMove={(e) => {
                if (dragging.current && e.isPrimary)
                  move(dragging.current, fromPointer(e));
              }}
              onLostPointerCapture={() => (dragging.current = null)}
            >
              {image && (
                <img
                  src={image}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full rounded"
                />
              )}
              <div
                className="absolute inset-y-0 left-0 bg-black/65"
                style={{ width: percent(start) }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-black/65"
                style={{ width: percent(duration - out) }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 border-y-[3px] border-accent"
                style={{ left: percent(start), right: percent(duration - out) }}
              />
              <div
                {...slider("playhead", "Playhead", position, 0, duration)}
                data-marker="playhead"
                className="absolute -inset-y-1 w-0.5 cursor-col-resize bg-white shadow"
                style={{ left: percent(position) }}
              />
              {(["start", "end"] as const).map((marker) => {
                const value = marker === "start" ? start : out;
                return (
                  <div
                    key={marker}
                    {...slider(
                      marker,
                      marker === "start" ? "Clip start" : "Clip end",
                      value,
                      marker === "start" ? 0 : start + Math.min(0.1, duration),
                      marker === "end"
                        ? duration
                        : out - Math.min(0.1, duration),
                    )}
                    data-marker={marker}
                    className={
                      "absolute -inset-y-0.5 flex w-4 cursor-ew-resize items-center justify-center rounded bg-accent text-white " +
                      (marker === "start" ? "-translate-x-full" : "")
                    }
                    style={{ left: percent(value) }}
                  >
                    <GripVertical size={13} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-muted">
              <span>{time(start)} in</span>
              <span>{time(out)} out</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              disabled={!!busy}
              className="inline-flex items-center gap-2"
              onClick={preview}
            >
              {previewing ? <Pause size={14} /> : <Play size={14} />}{" "}
              {previewing ? "Pause preview" : "Preview clip"}
            </button>
            <button
              className="quiet"
              disabled={!!busy || (start === 0 && out === duration)}
              onClick={() => {
                move("playhead", 0);
                setStart(0);
                setEnd(null);
              }}
            >
              Reset
            </button>
            <button
              className="ml-auto border-0 bg-accent font-semibold text-white hover:bg-deep"
              disabled={!!busy || (start === 0 && out === duration)}
              onClick={() => {
                player.current.pause();
                onSave(start, out);
              }}
            >
              {busy === "Trim" ? "Saving clip…" : "Save clip as copy"}
            </button>
          </div>
        </>
      ) : (
        !error && <p className="mt-4 text-muted">Reading timeline…</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
