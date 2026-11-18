import React, { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { AppWindow, ArrowRight, Check, Monitor } from "lucide-react";

import { SetupSwitch } from "./components/ui/setup-switch";
import { qualityPresets, readCaptureQuality, saveCaptureQuality } from "./capture-quality.mjs";

export type QualityKey = "high" | "balanced" | "compact";
export type CaptureQuality = {
  screen: QualityKey;
  camera: QualityKey;
};

const levels = ["high", "balanced", "compact"] as const;
const labels = { high: "High", balanced: "Balanced", compact: "Compact" };

export type CaptureSource = {
  id: string;
  name: string;
  thumbnail: string | null;
};

const sourceTypes = [
  { id: "screen", label: "Entire screen", icon: Monitor },
  { id: "window", label: "An app window", icon: AppWindow },
] as const;

export function SourcePicker({
  current,
  profileId,
  onChoose,
  onCancel,
  audioIssue = "",
}: {
  audioIssue?: string;
  current: CaptureSource | null;
  profileId: number;
  onChoose: (source: CaptureSource, systemAudio: boolean, quality: CaptureQuality) => void;
  onCancel: () => void;
}) {
  const audioKey = "glint.profile." + profileId + ".systemAudio";
  const [systemAudio, setSystemAudio] = useState(
    () => localStorage.getItem(audioKey) === "true",
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const cache = useRef(new Map<string, CaptureSource[]>());
  const [items, setItems] = useState<CaptureSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(
    current?.id.startsWith("window:") ? "window" : "screen",
  );
  const [selectedId, setSelectedId] = useState(current?.id);
  const [refresh, setRefresh] = useState(0);
  const [settingsError, setSettingsError] = useState("");
  const selected = items.find((item) => item.id === selectedId);
  const [quality, setQuality] = useState<CaptureQuality>(() =>
    readCaptureQuality(localStorage, profileId),
  );
  const updateQuality = (kind: "screen" | "camera", value: QualityKey) => {
    const next = { ...quality, [kind]: value };
    setQuality(next);
    saveCaptureQuality(localStorage, profileId, next);
  };

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function update() {
      let delay = 3000;
      try {
        const sources = await window.desk.sources(tab);
        if (!active) return;
        const incoming = new Map<string, CaptureSource>(sources.map((s) => [s.id, s]));
        const ordered = [];
        for (const previous of cache.current.get(tab) || []) {
          const next = incoming.get(previous.id);
          if (next) ordered.push(next);
          incoming.delete(previous.id);
        }
        ordered.push(...incoming.values());
        cache.current.set(tab, ordered);
        setItems(ordered);
        setError("");
      } catch (error) {
        if (!active) return;
        setItems([]);
        setError(
          (error instanceof Error ? error.message : String(error)).replace(
            /^Error invoking remote method 'sources': (?:Error: )?/,
            "",
          ),
        );
        delay = 4000;
      }
      setLoading(false);
      timer = setTimeout(update, delay);
    }

    update();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, refresh]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="source-heading"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <form
        className="flex h-[min(32rem,calc(100dvh-2rem))] flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected) onChoose(selected, systemAudio, quality);
        }}
      >
        <header className="shrink-0 px-5 pb-4 pt-5 sm:px-6">
          <h2
            id="source-heading"
            className="font-display text-2xl font-semibold"
          >
            Choose what to record
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs.Root
          value={tab}
          onValueChange={(value) => {
            setItems(cache.current.get(value) || []);
            setError("");
            setLoading(!cache.current.has(value));
            setTab(value);
          }}
          className="flex flex-col"
        >
          <Tabs.List
            aria-label="What to record"
            className="mx-5 grid shrink-0 grid-cols-2 rounded-xl border border-line bg-rail p-1 sm:mx-6"
          >
            {sourceTypes.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger
                key={id}
                value={id}
                className="flex items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-2 py-2 font-medium text-muted hover:bg-tint data-[state=active]:border-line data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {sourceTypes.map(({ id, icon: Icon }) => (
            <Tabs.Content
              key={id}
              value={id}
              className="min-h-0"
            >
              <div className="px-5 py-4 sm:px-6">
                {loading ? (
                  <p role="status" className="m-0 py-6 text-center text-muted">
                    Looking for {id}s…
                  </p>
                ) : error ? (
                  <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-rail p-4">
                    <p role="status" className="m-0">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        setError("");
                        setRefresh((value) => value + 1);
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : !items.length ? (
                  <div className="rounded-xl border border-dashed border-line py-8 text-center">
                    <Icon
                      aria-hidden="true"
                      className="mx-auto mb-2 size-6 text-muted"
                    />
                    <p role="status" className="m-0 font-medium">
                      No {id}s available
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {id === "window"
                        ? "Open the app window you want to record."
                        : "Connect a display to record it here."}
                    </p>
                  </div>
                ) : (
                  <fieldset className="grid grid-cols-2 gap-3">
                    <legend className="sr-only">Available {id}s</legend>
                    {items.map((item) => (
                      <label
                        key={item.id}
                        className="relative grid min-w-0 cursor-pointer"
                        onDoubleClick={() => onChoose(item, systemAudio, quality)}
                      >
                        <input
                          type="radio"
                          name="capture-source"
                          className="peer sr-only"
                          checked={selectedId === item.id}
                          onChange={() => setSelectedId(item.id)}
                        />
                        <span className="grid gap-2 rounded-xl border border-line bg-paper p-2 hover:border-accent peer-checked:border-accent peer-checked:bg-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                          <span className="relative grid aspect-video place-items-center overflow-hidden rounded-lg bg-rail">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="size-full object-contain"
                              />
                            ) : (
                              <Icon
                                aria-hidden="true"
                                className="size-7 text-muted"
                              />
                            )}
                            {selectedId === item.id && (
                              <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-white">
                                <Check aria-hidden="true" className="size-4" />
                              </span>
                            )}
                          </span>
                          <span className="break-words px-1 font-medium">
                            {item.name}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
        {!loading && !error && selectedId?.startsWith(tab + ":") && !selected && (
          <p role="status" className="px-5 pb-2 text-sm text-muted">That source is no longer available. Choose another.</p>
        )}
        {audioIssue && systemAudio && (
          <div role="alert" className="m-0 rounded-none border-t border-line px-5 py-3 text-sm sm:px-6">
            <p className="font-medium">{audioIssue}</p>
            {window.desk.isMac && (
              <p className="mt-1 text-muted">
                In System Settings › Privacy &amp; Security › Screen &amp; System Audio Recording,
                enable glint (Electron when running from source). Reopen glint if macOS asks.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {window.desk.isMac && (
                <button type="button" onClick={async () => {
                  setSettingsError("");
                  try {
                    await window.desk.openCaptureSettings();
                  } catch {
                    setSettingsError("Couldn’t open System Settings. Follow the steps above.");
                  }
                }}>
                  Open System Settings
                </button>
              )}
              <button type="button" disabled={!selected} onClick={() => {
                if (!selected) return;
                localStorage.setItem(audioKey, "false");
                setSystemAudio(false);
                onChoose(selected, false, quality);
              }}>
                Continue without system audio
              </button>
            </div>
            {settingsError && <p className="mt-1">{settingsError}</p>}
          </div>
        )}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-5 py-3 sm:px-6">
          <div>
            <p className="m-0 font-medium">System audio</p>
            <p className="m-0 text-sm text-muted">Include sound playing on your computer, across apps.</p>
          </div>
          <SetupSwitch label="Record system audio" checked={systemAudio} disabled={false}
            onChange={(enabled) => {
              localStorage.setItem(audioKey, String(enabled));
              setSystemAudio(enabled);
            }}
          />
        </div>
        <details className="border-t border-line px-5 py-3 sm:px-6">
          <summary className="cursor-pointer font-medium">
            Recording quality <span className="ml-2 text-sm font-normal text-muted">Screen {labels[quality.screen]} · Camera {labels[quality.camera]}</span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["screen", "camera"] as const).map((kind) => (
              <fieldset key={kind} className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-1 text-sm font-medium">
                  {kind === "screen" ? "Screen quality" : "Camera quality"}
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-rail p-1">
                  {levels.map((key) => (
                    <label key={key} className="relative grid cursor-pointer">
                      <input
                        type="radio"
                        name={`quality-${kind}`}
                        className="peer sr-only"
                        checked={quality[kind] === key}
                        onChange={() => updateQuality(kind, key)}
                      />
                      <span className="rounded-lg border border-transparent px-1 py-1.5 text-center text-sm text-muted peer-checked:border-line peer-checked:bg-paper peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                        <span className="block font-medium">{labels[key]}</span>
                        <span className="block text-xs">{kind === "screen" ? qualityPresets[key].longEdge + " px" : qualityPresets[key].cameraHeight + "p"}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <p className="mb-0 mt-2 text-xs text-muted">Screen sizes use the longest edge. Capture runs at up to 30 fps, depending on the source.</p>
        </details>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button
            type="button"
            className="border-transparent bg-transparent"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selected}
            className="inline-flex items-center gap-2 border-accent bg-accent font-semibold text-white hover:bg-deep disabled:hover:bg-accent"
          >
            {audioIssue && systemAudio ? "Retry preview" : tab === "screen" ? "Use this screen" : "Use this window"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </footer>
      </form>
    </dialog>
  );
}
