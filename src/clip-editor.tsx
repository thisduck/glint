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
export function ClipEditor({ video, player, busy, onSave, onDuration }) {
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
  const [cutMode, setCutMode] = useState(false);
  const [cuts, setCuts] = useState<[number, number][]>([]);
  const skip = useRef<[number, number][]>([]);
  // Each mode keeps its own handle range; switching never resets handles.
  const ranges = useRef<{ trim: [number, number | null]; cut: [number, number | null] }>({
    trim: [0, null],
    cut: [0, null],
  });
  function switchMode(next: boolean) {
    if (next === cutMode) return;
    ranges.current[cutMode ? "cut" : "trim"] = [start, end];
    const [s, e] = ranges.current[next ? "cut" : "trim"];
    setStart(s);
    setEnd(e);
    setCutMode(next);
  }
  const out = end ?? duration;

  const remaining = duration - cuts.reduce((sum, [a, b]) => sum + b - a, 0);
  const canCut =
    remaining - (out - start) > 0.05 &&
    !cuts.some(([a, b]) => start < b && out > a);
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
          onDuration(strip.duration);
          setImage(strip.image);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    let frame;
    function sync() {
      if (previewEnd.current !== null) {
        const gap = skip.current.find(
          ([a, b]) => media.currentTime >= a && media.currentTime < b,
        );
        if (gap) media.currentTime = gap[1];
      }
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
    skip.current = cutMode ? cuts : [];
    media.currentTime = cutMode ? 0 : start;
    previewEnd.current = cutMode ? duration : out;
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
    <section
      aria-label="Clip editor"
      className="mt-4 rounded-xl border border-line bg-paper p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Scissors className="size-4 text-accent" aria-hidden="true" /> Edit
          clip
        </h3>
        <div
          className="inline-flex gap-0.5 rounded-lg bg-rail p-1"
          role="group"
          aria-label="Edit mode"
        >
          {["Trim ends", "Cut sections"].map((label, i) => (
            <button
              key={label}
              disabled={!!busy}
              aria-pressed={Number(cutMode) === i}
              className="rounded-md border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted aria-pressed:border-line aria-pressed:bg-paper aria-pressed:text-ink"
              onClick={() => {
                player.current.pause();
                switchMode(Boolean(i));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {cutMode
          ? "Mark the part to remove in red, then choose Add cut."
          : "Drag the handles to set the clip’s start and end. Click a frame to seek."}
      </p>
      {duration > 0 ? (
        <>
          <div className="mx-3 mt-4">
            <div
              ref={rail}
              className="relative h-14 touch-none select-none rounded bg-deep sm:h-[72px]"
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
                hidden={cutMode}
                className="absolute inset-y-0 left-0 bg-black/65"
                style={{ width: percent(start) }}
              />
              <div
                hidden={cutMode}
                className="absolute inset-y-0 right-0 bg-black/65"
                style={{ width: percent(duration - out) }}
              />
              <div
                className={"pointer-events-none absolute inset-y-0 border-y-[3px] " + (cutMode ? "border-red-400 bg-red-900/40" : "border-accent")}
                style={{ left: percent(start), right: percent(duration - out) }}
              />
              {cutMode &&
                cuts.map(([a, b]) => (
                  <div
                    key={a}
                    className="pointer-events-none absolute inset-y-0 border-x border-red-400 bg-red-900/70"
                    style={{ left: percent(a), width: percent(b - a) }}
                  />
                ))}
              <div
                {...slider("playhead", "Playhead", position, 0, duration)}
                data-marker="playhead"
                className="absolute -inset-y-1 w-2 -translate-x-1/2 cursor-col-resize before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-white before:shadow"
                style={{ left: percent(position) }}
              />
              {(["start", "end"] as const).map((marker) => {
                const value = marker === "start" ? start : out;
                return (
                  <div
                    key={marker}
                    {...slider(
                      marker,
                      marker === "start"
                        ? cutMode
                          ? "Cut start"
                          : "Clip start"
                        : cutMode
                          ? "Cut end"
                          : "Clip end",
                      value,
                      marker === "start" ? 0 : start + Math.min(0.1, duration),
                      marker === "end"
                        ? duration
                        : out - Math.min(0.1, duration),
                    )}
                    data-marker={marker}
                    className={"absolute -inset-y-0.5 flex w-5 cursor-ew-resize items-center justify-center rounded text-white data-[marker=start]:-translate-x-full " + (cutMode ? "bg-red-800" : "bg-accent")}
                    style={{ left: percent(value) }}
                  >
                    <GripVertical className="size-4" aria-hidden="true" />
                  </div>
                );
              })}
            </div>
            <dl className="-mx-3 mt-3 grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div>
                <dt className="text-muted">
                  {cutMode ? "Cut start" : "Start"}
                </dt>
                <dd className="mt-0.5 font-semibold">{time(start)}</dd>
              </div>
              <div className="text-center">
                <dt className="text-muted">
                  {cutMode ? "After cuts" : "Clip length"}
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {time(cutMode ? remaining : out - start)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-muted">{cutMode ? "Cut end" : "End"}</dt>
                <dd className="mt-0.5 font-semibold">{time(out)}</dd>
              </div>
            </dl>
          </div>
          {cutMode && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                disabled={!!busy || !canCut}
                onClick={() => {
                  player.current.pause();
                  setCuts(
                    [...cuts, [start, out] as [number, number]].sort(
                      (a, b) => a[0] - b[0],
                    ),
                  );
                }}
              >
                Add cut
              </button>
              {cuts.map(([a, b]) => (
                <button
                  key={a}
                  disabled={!!busy}
                  aria-label={"Undo cut from " + time(a) + " to " + time(b)}
                  onClick={() => {
                    player.current.pause();
                    setCuts(cuts.filter((r) => r[0] !== a));
                  }}
                >
                  {time(a)}–{time(b)} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}
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
              disabled={
                !!busy ||
                (cutMode ? !cuts.length : start === 0 && out === duration)
              }
              onClick={() => {
                move("playhead", 0);
                if (cutMode) setCuts([]);
                setStart(0);
                setEnd(null);
              }}
            >
              Reset
            </button>
            <button
              className="ml-auto border-transparent bg-accent font-semibold text-white hover:bg-deep disabled:border-line disabled:bg-rail disabled:text-muted disabled:opacity-100"
              disabled={
                !!busy ||
                (cutMode ? !cuts.length : start === 0 && out === duration)
              }
              onClick={() => {
                player.current.pause();
                if (cutMode) onSave(0, duration, cuts);
                else onSave(start, out);
              }}
            >
              {busy === "Trim"
                ? "Saving clip…"
                : cutMode
                  ? `Save copy · ${cuts.length} cut${cuts.length === 1 ? "" : "s"}`
                  : "Save trimmed copy"}
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
