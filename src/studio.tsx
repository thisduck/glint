import React, { useEffect, useState, useRef } from "react";
import { ChoiceSelect } from "./components/ui/controls";

import { SetupSwitch } from "./components/ui/setup-switch";
import {
  AppWindow,
  Camera,
  ChevronDown,
  ChevronRight,
  Circle,
  Folder,
  HardDrive,
  Mic,
  Monitor,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { RecordingLibrary } from "./recording-library";
import { RecordingPage } from "./recording-page";
import { saveCaptureSwitch } from "./capture-preferences.mjs";
import { cameraComposition } from "./camera.mjs";
import { openMicrophone } from "./microphone.mjs";
import { SourcePicker, type CaptureSource } from "./source-picker";
const api = window.desk;
export function Studio({ profile, refreshProfile, lock, fail }) {
  const [source, choose] = useState<CaptureSource | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const showToolbar = Boolean(profile.toolbarEnabled);
  const cameraEnabled = Boolean(profile.cameraEnabled);
  const mic = Boolean(profile.micEnabled);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const deviceRevision = useRef(0);
  async function listInputs() {
    const revision = ++deviceRevision.current;
    const list = await navigator.mediaDevices.enumerateDevices();
    if (revision === deviceRevision.current)
      setDevices(
        list.filter(
          (d) =>
            d.kind === "audioinput" &&
            d.deviceId &&
            !["default", "communications"].includes(d.deviceId),
        ),
      );
  }
  useEffect(() => {
    const update = () => listInputs().catch(() => {});
    update();
    navigator.mediaDevices.addEventListener("devicechange", update);
    return () => {
      deviceRevision.current++;
      navigator.mediaDevices.removeEventListener("devicechange", update);
    };
  }, []);
  function saveMic(device, enabled) {
    return action("Saving microphone…", async () => {
      await api.setMicrophone(profile.id, device, enabled);
      await refreshProfile();
    });
  }
  function chooseMic(id) {
    if (id !== "show-inputs") return saveMic(id, mic);
    return action("Finding microphones…", async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        await listInputs();
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    });
  }
  const [phase, setPhase] = useState("idle"),
    [videos, setVideos] = useState([]),
    [preview, play] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [managing, manage] = useState(false);
  const [removing, remove] = useState("");
  const [destinationMessage, setDestinationMessage] = useState("");
  const [destinationError, setDestinationError] = useState("");
  const [accounts, setAccounts] = useState([]),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.all([api.driveConfigured(), api.accounts()])
      .then(([ready, rows]) => {
        setAccounts(rows);
        setConfigured(ready);
      })
      .catch((e) => setDestinationError(e.message));
  }, []);
  async function action(label, fn) {
    setBusy(label);
    lock(true);
    fail("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      await leaveSetup();
      fail(e.message);
    } finally {
      setBusy("");
      lock(false);
    }
  }
  async function saveDestination(label, fn, confirmation) {
    setDestinationMessage(label);
    setDestinationError("");
    await action(label, async () => {
      try {
        await fn();
        await refreshProfile();
        setDestinationMessage(confirmation);
      } catch (e) {
        setDestinationMessage("");
        setDestinationError(e.message);
      }
    });
  }
  function useAccount(id) {
    const connect = id === "add-account";
    return saveDestination(
      connect ? "Connecting to Google…" : "Saving Drive destination…",
      async () => {
        if (connect) {
          id = await api.connect();
          setAccounts(await api.accounts());
        }
        if (id !== profile.account || !profile.folder)
          await api.recordingsFolder(profile.id, id);
      },
      "Drive destination saved for " + profile.name + ".",
    );
  }
  const driveSaved = Boolean(profile.account && profile.folder);
  const savedEmail = accounts.find((a) => a.id === profile.account)?.email;
  const recorder = useRef(null);
  useEffect(
    () =>
      api.onStopRecording(() => {
        if (recorder.current && recorder.current.state !== "inactive")
          recorder.current.stop();
      }),
    [],
  );
  useEffect(
    () =>
      api.onRecordingToggle?.(() => {
        const r = recorder.current;
        if (r?.state === "recording") r.pause();
        else if (r?.state === "paused") r.resume();
      }),
    [],
  );
  async function refresh() {
    setVideos(await api.list(profile.id));
  }
  useEffect(() => {
    refresh().catch((e) => fail(e.message));
  }, []);
  const pendingUploads = videos.some((v) => v.uploadState === "pending");
  useEffect(() => {
    if (!pendingUploads) return;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const rows = await api.list(profile.id);
        if (active) setVideos(rows);
      } catch (e) {
        if (active) fail(e.message);
      }
      if (active) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pendingUploads, profile.id]);
  const setupActive = useRef<symbol | null>(null);
  const startPending = useRef(false);
  const handleSetup = useRef<(action: string) => void>();
  useEffect(
    () => api.onSetupCommand?.((action) => handleSetup.current?.(action)),
    [],
  );
  async function leaveSetup(restore = true) {
    if (!setupActive.current) return;
    setupActive.current = null;
    await api.closeSetup(restore);
  }
  async function showSetup(item: CaptureSource) {
    if (!api.openSetup || setupActive.current) return;
    const session = Symbol();
    setupActive.current = session;
    try {
      const opened = await api.openSetup(item.id, {
        cameraOn: !!composition.current,
        micOn: mic,
        position: cameraPosition.current,
        busy: false,
      });
      if (!opened && setupActive.current === session)
        setupActive.current = null;
    } catch (error) {
      if (setupActive.current !== session) return;
      setupActive.current = null;
      fail(
        "On-screen setup could not open. You can still start here. " +
          error.message,
      );
    }
  }
  const capture = useRef<MediaStream | null>(null);
  const composition = useRef(null);
  const cameraPosition = useRef({ x: 1, y: 1, scale: 0.23 });
  const [cameraScale, setCameraScale] = useState(0.23);
  const [cameraLive, setCameraLive] = useState(false);
  const cameraOn = source ? cameraLive : cameraEnabled;
  useEffect(
    () =>
      api.onCameraPosition?.((point) => {
        cameraPosition.current = { ...cameraPosition.current, ...point };
        setCameraScale(cameraPosition.current.scale);
      }),
    [],
  );
  useEffect(
    () =>
      api.onPortraitRequest?.(() => {
        const frame = composition.current?.portrait();
        if (frame) api.sendPortrait(frame);
      }),
    [],
  );
  useEffect(() => {
    if (setupActive.current)
      api
        .updateSetup({
          cameraOn,
          micOn: mic,
          position: cameraPosition.current,
          busy: !!busy || phase !== "idle",
        })
        .catch((e) => fail(e.message));
  }, [cameraOn, cameraScale, mic, busy, phase]);
  function resizeCamera(scale) {
    cameraPosition.current = { ...cameraPosition.current, scale };
    setCameraScale(scale);
  }
  async function toggleCamera(enabled) {
    await action(enabled && capture.current ? "Opening camera…" : "Saving camera preference…", async () => {
      await saveCaptureSwitch(api, localStorage, profile, "cameraEnabled", enabled);
      await refreshProfile();
      if (!enabled) {
        composition.current?.close();
        composition.current = null;
        setCameraLive(false);
      } else if (capture.current) {
        await attachCamera(capture.current);
      }
    });
  }
  function setToolbar(enabled) {
    return action("Saving toolbar preference…", async () => {
      await saveCaptureSwitch(api, localStorage, profile, "toolbarEnabled", enabled);
      await refreshProfile();
    });
  }
  async function attachCamera(display: MediaStream) {
    const result = await cameraComposition(display, cameraPosition, () =>
      setNotice("Camera disconnected. Screen recording continues."),
    );
    if (capture.current !== display) {
      result.close();
      return;
    }
    composition.current = result;
    setCameraLive(true);
  }
  const previewVideo = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  function releaseCapture() {
    leaveSetup().catch((e) => fail(e.message));
    composition.current?.close();
    composition.current = null;
    setCameraLive(false);
    const stream = capture.current;
    capture.current = null;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseCapture();
    };
  }, []);
  useEffect(() => {
    if (previewVideo.current)
      previewVideo.current.srcObject =
        composition.current?.stream || capture.current;
  }, [source, phase, cameraOn]);
  async function selectSource(item: CaptureSource) {
    setPickerOpen(false);
    setPhase("previewing");
    lock(true);
    setNotice("");
    fail("");
    try {
      await api.source(item.id);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!mounted.current || !track || track.readyState === "ended") {
        stream.getTracks().forEach((t) => t.stop());
        if (mounted.current)
          throw Error(
            "No video arrived from this source. Choose it again or check Screen Recording access.",
          );
        return;
      }
      releaseCapture();
      capture.current = stream;
      track.onended = () => {
        releaseCapture();
        choose(null);
        setNotice("Screen sharing ended. Choose another screen or window.");
        if (recorder.current && recorder.current.state !== "inactive")
          recorder.current.stop();
      };
      choose(item);
      if (cameraEnabled) {
        try {
          await attachCamera(stream);
        } catch (error) {
          fail("Could not open the camera. " + error.message);
          return;
        }
      }
      if (capture.current === stream) await showSetup(item);
    } catch (e) {
      fail("Could not preview this source. " + e.message);
    } finally {
      if (mounted.current) {
        setPhase("idle");
        lock(false);
      }
    }
  }
  function placeCamera(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clamp = (n) => Math.max(0, Math.min(1, n));
    const inset =
      Math.min(bounds.width, bounds.height) *
      (0.025 + cameraPosition.current.scale / 2);
    cameraPosition.current = {
      ...cameraPosition.current,
      x: clamp(
        (event.clientX - bounds.left - inset) / (bounds.width - 2 * inset),
      ),
      y: clamp(
        (event.clientY - bounds.top - inset) / (bounds.height - 2 * inset),
      ),
    };
  }
  async function start() {
    if (startPending.current || recorder.current || phase !== "idle") return;
    startPending.current = true;
    const fromSetup = setupActive.current;
    let activeMs = 0,
      startedAt,
      microphone,
      writeFailed = false;
    let tracks = [],
      id = null,
      pending = Promise.resolve(),
      failure = null;
    setPhase("starting");
    lock(true);
    fail("");
    function reset() {
      api.showStudio().catch((e) => fail(e.message));
      microphone?.close();
      releaseCapture();
      choose(null);
      tracks.forEach((t) => t.stop());
      recorder.current = null;
      setPhase("idle");
      lock(false);
    }
    try {
      const display = capture.current;
      if (!display || display.getVideoTracks()[0]?.readyState !== "live")
        throw Error(
          "The selected source is no longer sharing. Choose a screen or window again.",
        );
      tracks.push(...(composition.current?.stream || display).getVideoTracks());
      if (mic) {
        microphone = await openMicrophone(
          navigator.mediaDevices,
          profile.microphoneId,
          () => setNotice("Using the system default microphone."),
          (error) => {
            failure = error;
            if (recorder.current && recorder.current.state !== "inactive")
              recorder.current.stop();
          },
        );
        tracks.push(microphone.track);
        listInputs().catch(() => {});
      }
      if (fromSetup && setupActive.current !== fromSetup) {
        microphone?.close();
        setPhase("idle");
        lock(false);
        return;
      }
      const stream = new MediaStream(tracks);
      const r = new MediaRecorder(stream, { mimeType: "video/webm" });
      await leaveSetup(false);
      if (!(await api.countdown(source.id))) {
        microphone?.close();
        await api.showStudio();
        setPhase("idle");
        lock(false);
        if (fromSetup && capture.current === display) await showSetup(source);
        return;
      }
      id = await api.begin(profile.id);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size)
          pending = pending
            .then(async () => {
              if (!writeFailed)
                await api.append(
                  id,
                  new Uint8Array(await e.data.arrayBuffer()),
                );
            })
            .catch((err) => {
              writeFailed = true;
              failure = err;
              if (r.state !== "inactive") r.stop();
            });
      };
      r.onerror = (e) => {
        failure = e.error || Error("Capture interrupted");
        if (r.state !== "inactive") r.stop();
      };
      function elapsed() {
        return Math.round(
          activeMs + (startedAt == null ? 0 : performance.now() - startedAt),
        );
      }
      r.onpause = () => {
        activeMs = elapsed();
        startedAt = null;
        setPhase("paused");
        api.recordingStatus(true, activeMs).catch((e) => fail(e.message));
      };
      r.onresume = () => {
        startedAt = performance.now();
        setPhase("recording");
        api.recordingStatus(false, activeMs).catch((e) => fail(e.message));
      };
      r.onstop = async () => {
        const duration = elapsed();
        setPhase("saving");
        tracks.forEach((t) => t.stop());
        try {
          await pending;
          await api.end(id, !failure, duration, failure?.message);
          await refresh();
          play(id);
        } catch (e) {
          fail(e.message);
        } finally {
          reset();
        }
      };
      const videoTrack = display.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === "ended")
        throw Error(
          "Capture ended before recording started. Choose a capture source again.",
        );
      await api.recordingMenu(
        showToolbar,
        cameraOn,
        cameraPosition.current,
        source.id.startsWith("window:"),
      );
      if (failure) throw failure;
      startedAt = performance.now();
      r.start(1000);
      setPhase("recording");
    } catch (e) {
      if (id) await api.end(id, false).catch(() => {});
      fail(e.message);
      reset();
    } finally {
      startPending.current = false;
    }
  }
  handleSetup.current = async (command) => {
    if (command === "sourceLost") {
      releaseCapture();
      choose(null);
      setNotice("The selected window closed. Choose another source.");
      return;
    }
    if (!setupActive.current) return;
    if (command === "cancel") {
      await leaveSetup();
      return;
    }
    if (busy || phase !== "idle") return;
    if (command === "start") await start();
    if (command === "toggleMic") await saveMic(profile.microphoneId, !mic);
    if (command === "toggleCamera") await toggleCamera(!cameraOn);
  };
  const finished = videos.find((v) => v.id === preview);
  if (finished)
    return (
      <RecordingPage
        key={finished.id}
        video={finished}
        onOpen={play}
        profile={profile}
        onBack={() => play("")}
        refresh={refresh}
      />
    );
  const setupLocked = !!busy || phase !== "idle";
  const capturing = phase === "recording" || phase === "paused";
  const settings = capture.current?.getVideoTracks()[0]?.getSettings?.();
  const bubblePixels = Math.round(
    Math.min(settings?.width || 0, settings?.height || 0) * cameraScale,
  );
  return (
    <>
      <h2 className="mb-4 mt-7 font-display text-2xl font-medium tracking-tight">
        Recording studio
      </h2>
      {pickerOpen && (
        <SourcePicker
          current={source}
          onCancel={() => setPickerOpen(false)}
          onChoose={selectSource}
        />
      )}
      {busy && busy !== destinationMessage && <p role="status">{busy}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="studio-setup" aria-label="Set up a recording">
        <div className="capture-panel">
          {source ? (
            <>
              <div className="capture-view">
                <video
                  aria-label="Selected capture source preview"
                  ref={previewVideo}
                  muted
                  autoPlay
                  playsInline
                  poster={source.thumbnail ?? undefined}
                  className="capture-video"
                  title={cameraOn ? "Drag to position your camera" : undefined}
                  onPointerDown={(e) => {
                    if (cameraOn && !setupLocked) {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      placeCamera(e);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (
                      cameraOn &&
                      e.currentTarget.hasPointerCapture(e.pointerId)
                    )
                      placeCamera(e);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="mr-auto min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {capturing
                      ? phase === "paused"
                        ? "Paused"
                        : "Recording"
                      : "Live preview"}
                  </p>
                  <p className="truncate font-medium" title={source.name}>
                    {source.name}
                  </p>
                </div>
                <button
                  className="quiet"
                  disabled={setupLocked}
                  onClick={() => setPickerOpen(true)}
                >
                  Change source
                </button>
                <button
                  className="quiet"
                  disabled={setupLocked}
                  onClick={() => {
                    releaseCapture();
                    choose(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </>
          ) : (
            <div className="source-empty">
              <div className="source-glyph" aria-hidden="true">
                <Monitor size={34} strokeWidth={1.45} />
                <AppWindow size={22} />
              </div>
              <h3>What would you like to record?</h3>
              <button
                className="studio-primary"
                disabled={setupLocked}
                onClick={() => setPickerOpen(true)}
              >
                <Monitor size={16} />
                {phase === "previewing"
                  ? "Opening preview…"
                  : "Choose screen or window"}
              </button>
            </div>
          )}
        </div>
        <div className="setup-options">
          <section className="setup-option" aria-label="Microphone setup">
            <div className="option-title">
              <Mic size={17} />
              <h3>Microphone</h3>
              <SetupSwitch
                label="Microphone"
                checked={mic}
                disabled={setupLocked}
                onChange={(enabled) => saveMic(profile.microphoneId, enabled)}
              />
            </div>
            {mic ? (
              <ChoiceSelect
                label="Recording microphone"
                value={profile.microphoneId}
                disabled={!!busy || phase !== "idle"}
                onChange={chooseMic}
                options={[
                  { value: "default", label: "System default" },
                  ...devices.map((d, i) => ({
                    value: d.deviceId,
                    label: d.label || "Microphone " + (i + 1),
                  })),
                  ...(profile.microphoneId !== "default" &&
                  !devices.some((d) => d.deviceId === profile.microphoneId)
                    ? [
                        {
                          value: profile.microphoneId,
                          label: "Unavailable · use system default",
                        },
                      ]
                    : []),
                  ...(!devices.some((d) => d.label)
                    ? [{ value: "show-inputs", label: "Find microphones…" }]
                    : []),
                ]}
              />
            ) : (
              <p className="option-note">Record without narration</p>
            )}
          </section>
          <section className="setup-option" aria-label="Camera setup">
            <div className="option-title">
              <Camera size={17} />
              <h3>Camera bubble</h3>
              <SetupSwitch
                label="Camera bubble"
                checked={cameraOn}
                disabled={setupLocked}
                onChange={toggleCamera}
              />
            </div>
            {cameraOn && source ? (
              <>
                <label
                  className="mt-2 flex items-center justify-between gap-2 text-xs"
                  htmlFor="bubble-size"
                >
                  Bubble size
                  <output
                    htmlFor="bubble-size"
                    className="font-medium tabular-nums"
                  >
                    {Math.round(cameraScale * 100)}%
                    {bubblePixels > 0 && " · " + bubblePixels + " px"}
                  </output>
                </label>
                <input
                  id="bubble-size"
                  type="range"
                  min="10"
                  max="48"
                  value={Math.round(cameraScale * 100)}
                  disabled={setupLocked}
                  aria-valuetext={
                    Math.round(cameraScale * 100) +
                    " percent of the shorter side"
                  }
                  onChange={(e) => resizeCamera(Number(e.target.value) / 100)}
                />
                <p className="option-note">
                  Drag on the preview to move your camera.
                </p>
              </>
            ) : (
              <p className="option-note">
                {cameraOn
                  ? "Your camera appears when you choose a screen or window."
                  : "Record just your screen"}
              </p>
            )}
          </section>
          <details className="setup-option setup-more">
            <summary>
              <SlidersHorizontal size={15} />
              Recording controls
              <ChevronDown size={14} />
            </summary>
            <div className="option-title mt-3">
              <span>Floating toolbar</span>
              <SetupSwitch
                label="Floating controls"
                disabled={setupLocked}
                checked={showToolbar}
                onChange={setToolbar}
              />
            </div>
            <p className="option-note">
              {showToolbar
                ? "Pause or stop from a movable toolbar."
                : "Pause or stop from the glint menu bar icon."}
              {showToolbar &&
                source?.id.startsWith("screen:") &&
                " The toolbar can appear in a full-screen recording."}
            </p>
          </details>
        </div>
        {source && (
          <div className="setup-footer">
            <span className="text-sm text-muted">
              {phase === "idle"
                ? "Recording starts after a 3-second countdown."
                : phase === "paused"
                  ? "Recording paused"
                  : phase === "recording"
                    ? "Recording in progress"
                    : phase === "saving"
                      ? "Saving recording…"
                      : "Preparing recording…"}
            </span>
            {phase === "idle" && (
              <button disabled={!!busy} onClick={() => showSetup(source)}>
                On-screen setup
              </button>
            )}
            {capturing && (
              <button
                onClick={() =>
                  phase === "paused"
                    ? recorder.current.resume()
                    : recorder.current.pause()
                }
              >
                {phase === "paused" ? "Resume" : "Pause"}
              </button>
            )}
            <button
              className="studio-primary"
              disabled={!!busy || (!capturing && phase !== "idle")}
              onClick={() => (capturing ? recorder.current.stop() : start())}
            >
              {capturing ? (
                <Square size={14} />
              ) : (
                <Circle size={14} fill="currentColor" />
              )}
              {capturing ? "Stop recording" : "Start recording"}
            </button>
          </div>
        )}
      </section>
      <section aria-label="Recording destination" className="destination">
        <button
          className="destination-summary"
          aria-expanded={destinationOpen}
          onClick={() => setDestinationOpen(!destinationOpen)}
        >
          <span className="destination-icon">
            {driveSaved && profile.autoUpload ? (
              <Folder size={20} />
            ) : (
              <HardDrive size={20} />
            )}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-medium">
              {driveSaved && profile.autoUpload
                ? "Auto-upload to " + profile.folderName
                : "Save on this Mac"}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {driveSaved
                ? profile.autoUpload
                  ? "Google Drive · " +
                    ({
                      private: "Only me",
                      folder: "Folder access",
                      link: "Anyone with the link",
                    }[profile.privacy] || "Folder access")
                  : "Manual upload to " + profile.folderName
                : "Google Drive is optional"}
            </span>
          </span>
          <span className="text-xs text-muted">Settings</span>
          <ChevronDown
            className={destinationOpen ? "rotate-180" : ""}
            size={16}
          />
        </button>
        {destinationOpen && (
          <div className="border-t border-line px-4 pb-4 pt-3">
            {driveSaved && (
              <p className="text-sm text-muted">
                {profile.name} · {savedEmail || "Google Drive"}
              </p>
            )}
            {configured === false && (
              <p className="mt-3 text-sm text-muted">
                Google Drive is unavailable in this build.
              </p>
            )}
            {configured && (
              <fieldset
                disabled={!!busy || phase !== "idle"}
                className="mt-2 flex flex-wrap items-center gap-3"
              >
                {!driveSaved && (
                  <p className="w-full text-sm text-muted">
                    Choose an account to save uploads in its{" "}
                    <strong>glint – {profile.name}</strong> folder.
                  </p>
                )}
                {accounts.length ? (
                  <ChoiceSelect
                    label="Choose Google account"
                    value={driveSaved ? profile.account : ""}
                    disabled={!!busy || phase !== "idle"}
                    onChange={useAccount}
                    options={[
                      ...accounts.map((a) => ({ value: a.id, label: a.email })),
                      { value: "add-account", label: "Sign in with Google…" },
                    ]}
                  />
                ) : (
                  <button onClick={() => useAccount("add-account")}>
                    Connect Google Drive
                  </button>
                )}
                {driveSaved && (
                  <button
                    onClick={() =>
                      saveDestination(
                        "Choosing folder…",
                        () => api.folder(profile.id, profile.account),
                        "Drive folder updated.",
                      )
                    }
                  >
                    Change folder…
                  </button>
                )}
              </fieldset>
            )}
            {accounts.length > 0 && (
              <details
                className="mt-3 text-sm"
                open={managing}
                onToggle={(e) => manage(e.currentTarget.open)}
              >
                <summary className="cursor-pointer text-muted">
                  Manage accounts
                </summary>
                {accounts.map((account) => (
                  <fieldset
                    key={account.id}
                    disabled={!!busy || phase !== "idle"}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <span className="mr-auto break-all">{account.email}</span>
                    {removing === account.id ? (
                      <>
                        <p className="w-full">
                          Disconnecting this account turns off Drive uploads for
                          every profile using it. Your recordings stay on this
                          Mac and in Drive.
                        </p>
                        <button
                          onClick={() =>
                            saveDestination(
                              "Disconnecting…",
                              async () => {
                                await api.disconnect(account.id);
                                setAccounts(await api.accounts());
                                remove("");
                              },
                              "Account disconnected from glint.",
                            )
                          }
                        >
                          Disconnect from glint
                        </button>
                        <button onClick={() => remove("")}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            saveDestination(
                              "Reconnecting…",
                              () => api.connect(account.id),
                              "Account reconnected.",
                            )
                          }
                        >
                          Reconnect
                        </button>
                        <button onClick={() => remove(account.id)}>
                          Disconnect…
                        </button>
                      </>
                    )}
                  </fieldset>
                ))}
              </details>
            )}
            {driveSaved && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-line pt-3">
                <input
                  type="checkbox"
                  role="switch"
                  className="accent-accent"
                  disabled={!configured || !!busy || phase !== "idle"}
                  checked={Boolean(profile.autoUpload)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    saveDestination(
                      "Saving preference…",
                      () => api.setAutoUpload(profile.id, enabled),
                      enabled
                        ? "Auto-upload enabled."
                        : "Auto-upload turned off.",
                    );
                  }}
                />{" "}
                Auto-upload new recordings
              </label>
            )}
            {driveSaved && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  Sharing for new uploads
                </span>
                <ChoiceSelect
                  label="Sharing for new uploads"
                  value={profile.privacy || ""}
                  disabled={
                    !profile.canSetPrivacy ||
                    !api.setPrivacy ||
                    !!busy ||
                    phase !== "idle"
                  }
                  options={[
                    { value: "private", label: "Private · only me" },
                    { value: "folder", label: "Use folder access" },
                    { value: "link", label: "Anyone with the link" },
                  ]}
                  onChange={(value) =>
                    saveDestination(
                      "Saving sharing preference…",
                      () => api.setPrivacy(profile.id, value),
                      "Sharing preference saved for new recordings.",
                    )
                  }
                />
                {(!profile.canSetPrivacy || !api.setPrivacy) && (
                  <p className="w-full text-sm text-muted">
                    Quit glint with ⌘Q and reopen it to enable sharing settings.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div aria-live="polite" className="text-sm text-muted">
          {destinationMessage && (
            <p className="px-4 pb-3">{destinationMessage}</p>
          )}
        </div>
        {destinationError && <p role="alert">{destinationError}</p>}
      </section>
      <RecordingLibrary
        videos={videos}
        profile={profile}
        disabled={!!busy || phase !== "idle"}
        onOpen={(id) => {
          releaseCapture();
          choose(null);
          play(id);
        }}
        onCopy={(id) =>
          api
            .share(id, true)
            .then(() => setNotice("Link copied"))
            .catch((e) => fail(e.message))
        }
        onViewDrive={(id) => api.share(id, false).catch((e) => fail(e.message))}
        onUpload={(id) =>
          action("Uploading…", async () => {
            await api.upload(id);
            await refresh();
          })
        }
      />
    </>
  );
}
