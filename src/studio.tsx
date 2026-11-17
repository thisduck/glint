import React, { useEffect, useState, useRef } from "react";
import { ChoiceSelect, MicrophoneCheckbox } from "./components/ui/controls";

import { Folder, HardDrive } from "lucide-react";
import { RecordingPage } from "./recording-page";
import { openMicrophone } from "./microphone.mjs";
import { SourcePicker, type CaptureSource } from "./source-picker";
const api = window.desk;
export function Studio({ profile, refreshProfile, lock, fail }) {
  const [source, choose] = useState<CaptureSource | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const [editingDestination, editDestination] = useState(false);
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
        editDestination(false);
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
        if (recorder.current?.state === "recording") recorder.current.stop();
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
  const capture = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  function releaseCapture() {
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
    if (previewVideo.current) previewVideo.current.srcObject = capture.current;
  }, [source, phase]);
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
        if (recorder.current?.state === "recording") recorder.current.stop();
      };
      choose(item);
    } catch (e) {
      fail("Could not preview this source. " + e.message);
    } finally {
      if (mounted.current) {
        setPhase("idle");
        lock(false);
      }
    }
  }
  async function start() {
    let startedAt,
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
      tracks.push(...display.getTracks());
      if (mic) {
        microphone = await openMicrophone(
          navigator.mediaDevices,
          profile.microphoneId,
          () => setNotice("Using the system default microphone."),
          (error) => {
            failure = error;
            if (recorder.current?.state === "recording")
              recorder.current.stop();
          },
        );
        tracks.push(microphone.track);
        listInputs().catch(() => {});
      }
      const stream = new MediaStream(tracks);
      const r = new MediaRecorder(stream, { mimeType: "video/webm" });
      if (!(await api.countdown())) {
        microphone?.close();
        await api.showStudio();
        setPhase("idle");
        lock(false);
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
              if (r.state === "recording") r.stop();
            });
      };
      r.onerror = (e) => {
        failure = e.error || Error("Capture interrupted");
        if (r.state === "recording") r.stop();
      };
      r.onstop = async () => {
        const duration = Math.round(performance.now() - startedAt);
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
      await api.recordingMenu();
      if (failure) throw failure;
      startedAt = performance.now();
      r.start(1000);
      setPhase("recording");
    } catch (e) {
      if (id) await api.end(id, false).catch(() => {});
      fail(e.message);
      reset();
    }
  }
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
      <section className="overflow-hidden rounded-xl border border-line bg-paper">
        <div className="stage">
          {source ? (
            <video
              aria-label="Selected capture source preview"
              ref={previewVideo}
              autoPlay
              muted
              playsInline
              poster={source.thumbnail ?? undefined}
              className="max-h-44 max-w-full rounded-md object-contain"
            />
          ) : (
            <svg
              viewBox="0 0 92 65"
              className="h-12 w-[68px]"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="9"
                y="11"
                width="54"
                height="36"
                rx="5"
                stroke="var(--glass)"
                transform="rotate(-10 36 29)"
              />
              <rect
                x="25"
                y="15"
                width="58"
                height="39"
                rx="5"
                stroke="var(--shine)"
                strokeWidth="1.6"
                fill="var(--deep)"
              />
              <path
                d="M26 24h55M36 43l8-10m-3 13 5-6"
                stroke="var(--glass)"
                strokeLinecap="round"
              />
              <circle cx="31" cy="20" r="1" fill="var(--shine)" />
            </svg>
          )}
          <h3 className="max-w-full break-words font-display text-2xl">
            {source?.name || "Screen capture"}
          </h3>
          {phase === "recording" && (
            <span role="status">Recording in progress</span>
          )}
          {!!source && phase === "idle" && (
            <div className="flex gap-3">
              <button
                className="refresh"
                disabled={!!busy}
                onClick={() => setPickerOpen(true)}
              >
                Change
              </button>
              <button
                className="refresh"
                disabled={!!busy}
                onClick={() => {
                  releaseCapture();
                  choose(null);
                }}
              >
                End preview
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-paper px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <MicrophoneCheckbox
              checked={mic}
              disabled={!!busy || phase !== "idle"}
              onChange={(enabled) => saveMic(profile.microphoneId, enabled)}
            />
            {mic && (
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
            )}
          </div>
          <button
            className="min-h-11 rounded-lg border-0 bg-accent px-5 font-semibold text-white hover:bg-deep"
            disabled={!!busy || (phase !== "idle" && phase !== "recording")}
            onClick={() =>
              phase === "recording"
                ? recorder.current.stop()
                : source
                  ? start()
                  : setPickerOpen(true)
            }
          >
            {
              {
                idle: source ? "Start recording" : "Choose screen or window",
                recording: "Stop recording",
                previewing: "Opening preview…",
                starting: "Starting…",
                saving: "Saving…",
              }[phase]
            }
          </button>
        </div>
      </section>
      <section
        aria-label="Recording destination"
        className="destination p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          {driveSaved ? (
            <Folder aria-hidden="true" className="mt-1 size-5 text-muted" />
          ) : (
            <HardDrive aria-hidden="true" className="mt-1 size-5 text-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted">
              {profile.name} destination
            </p>
            <h3 className="mt-1 break-words font-semibold">
              {driveSaved ? profile.folderName : "On this Mac"}
            </h3>
            {driveSaved && (
              <p className="break-all text-sm text-muted">
                Google Drive{savedEmail && " · " + savedEmail}
              </p>
            )}
          </div>
          {driveSaved && (
            <button
              className="quiet"
              disabled={!!busy || phase !== "idle"}
              onClick={() => {
                editDestination(!editingDestination);
                setDestinationMessage("");
                setDestinationError("");
              }}
            >
              {editingDestination ? "Done" : "Change"}
            </button>
          )}
        </div>
        {configured === false && (
          <p className="mt-3 text-sm text-muted">
            Google Drive is unavailable in this build.
          </p>
        )}
        {configured && (!driveSaved || editingDestination) && (
          <fieldset
            disabled={!!busy || phase !== "idle"}
            className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4"
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
                      every profile using it. Your recordings stay on this Mac
                      and in Drive.
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
                  enabled ? "Auto-upload enabled." : "Auto-upload turned off.",
                );
              }}
            />{" "}
            Auto-upload new recordings
          </label>
        )}
        {driveSaved && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Sharing for new uploads</span>
            <ChoiceSelect
              label="Sharing for new uploads"
              value={profile.privacy || ""}
              disabled={!profile.canSetPrivacy || !api.setPrivacy || !!busy || phase !== "idle"}
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
            {(!profile.canSetPrivacy || !api.setPrivacy) && <p className="w-full text-sm text-muted">Quit glint with ⌘Q and reopen it to enable sharing settings.</p>}
          </div>
        )}
        <div aria-live="polite" className="text-sm text-muted">
          {destinationMessage && <p className="mt-3">{destinationMessage}</p>}
        </div>
        {destinationError && <p role="alert">{destinationError}</p>}
      </section>
      <section className="library mt-6 border-t border-line pt-6">
        <h2 className="mb-4 font-display text-2xl font-medium tracking-tight">
          Recordings
        </h2>
        {!videos.length && (
          <small className="block rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No recordings in {profile.name} yet.
          </small>
        )}
        {videos.map((v) => (
          <article key={v.id}>
            <time>{v.title || new Date(v.created).toLocaleString()}</time>{" "}
            <button
              disabled={!!busy || phase !== "idle"}
              onClick={() => {
                releaseCapture();
                choose(null);
                play(v.id);
              }}
            >
              View recording
            </button>
            {v.remote ? (
              <>
                <button
                  onClick={() =>
                    api
                      .share(v.id, true)
                      .then(() => setNotice("Link copied"))
                      .catch((e) => fail(e.message))
                  }
                >
                  Copy link
                </button>
                <button
                  onClick={() =>
                    api.share(v.id, false).catch((e) => fail(e.message))
                  }
                >
                  Open in Drive
                </button>
              </>
            ) : (
              <button
                disabled={
                  !!busy ||
                  phase !== "idle" ||
                  v.uploadState === "pending" ||
                  !(v.folder || profile.folder)
                }
                onClick={() =>
                  action("Uploading…", async () => {
                    await api.upload(v.id);
                    await refresh();
                  })
                }
              >
                {v.uploadState === "pending"
                  ? "Uploading…"
                  : v.uploadState === "failed"
                    ? "Retry Drive upload"
                    : "Save to Drive"}
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
