import React, { useEffect, useState, useRef } from "react";
import { ChoiceSelect, MicrophoneCheckbox } from "./components/ui/controls";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Folder, ChevronDown } from "lucide-react";
const api = window.desk;
export function Studio({ profile, refreshProfile, lock, fail }) {
  const [sources, setSources] = useState([]),
    [source, choose] = useState(""),
    [mic, setMic] = useState(true);
  const [phase, setPhase] = useState("idle"),
    [videos, setVideos] = useState([]),
    [preview, play] = useState("");
  const [accounts, setAccounts] = useState([]),
    [account, setAccount] = useState(profile.account || ""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api
      .accounts()
      .then(setAccounts)
      .catch((e) => fail(e.message));
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
  const recorder = useRef(null);
  async function refresh() {
    setVideos(await api.list(profile.id));
  }
  useEffect(() => {
    refresh().catch((e) => fail(e.message));
  }, []);
  async function load() {
    try {
      const items = await api.sources();
      setSources(items);
      choose(items[0]?.id || "");
      if (!items.length)
        fail(
          "No sources available. Check Screen Recording in macOS System Settings.",
        );
    } catch (e) {
      fail(e.message);
    }
  }
  async function start() {
    let tracks = [],
      id = null,
      pending = Promise.resolve(),
      failure = null;
    setPhase("starting");
    lock(true);
    fail("");
    function reset() {
      tracks.forEach((t) => t.stop());
      recorder.current = null;
      setPhase("idle");
      lock(false);
    }
    try {
      await api.source(source);
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      tracks.push(...display.getTracks());
      if (mic)
        tracks.push(
          ...(
            await navigator.mediaDevices.getUserMedia({ audio: true })
          ).getAudioTracks(),
        );
      const stream = new MediaStream(tracks);
      const r = new MediaRecorder(stream, { mimeType: "video/webm" });
      id = await api.begin(profile.id);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size)
          pending = pending
            .then(async () => {
              if (!failure)
                await api.append(
                  id,
                  new Uint8Array(await e.data.arrayBuffer()),
                );
            })
            .catch((err) => {
              failure = err;
              if (r.state === "recording") r.stop();
            });
      };
      r.onerror = (e) => {
        failure = e.error || Error("Capture interrupted");
        if (r.state === "recording") r.stop();
      };
      r.onstop = async () => {
        setPhase("saving");
        tracks.forEach((t) => t.stop());
        try {
          await pending;
          await api.end(id);
          await refresh();
          play(id);
          if (failure) throw failure;
        } catch (e) {
          fail(e.message);
        } finally {
          reset();
        }
      };
      display.getVideoTracks()[0].onended = () => {
        if (r.state === "recording") r.stop();
      };
      r.start(1000);
      setPhase("recording");
    } catch (e) {
      if (id) await api.end(id).catch(() => {});
      reset();
      fail(e.message);
    }
  }
  return (
    <>
      {busy && <p role="status">{busy}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="overflow-hidden rounded-xl border border-line bg-paper">
        <div className="stage">
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
          <h3 className="max-w-full break-words font-display text-2xl">
            {sources.find((s) => s.id === source)?.name || "Screen capture"}
          </h3>
          {phase === "recording" && (
            <span role="status">Recording in progress</span>
          )}
          {!!sources.length && (
            <ChoiceSelect
              label="Capture source"
              value={source}
              onChange={choose}
              disabled={phase !== "idle"}
              options={sources.map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
          {!!source && phase === "idle" && (
            <button className="refresh" onClick={load}>
              Refresh sources
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-paper px-5 py-4">
          <MicrophoneCheckbox
            checked={mic}
            disabled={phase !== "idle"}
            onChange={setMic}
          />
          <button
            className="min-h-11 rounded-lg border-0 bg-accent px-5 font-semibold text-white hover:bg-deep"
            disabled={!!busy || (phase !== "idle" && phase !== "recording")}
            onClick={() =>
              phase === "recording"
                ? recorder.current.stop()
                : source
                  ? start()
                  : load()
            }
          >
            {
              {
                idle: source ? "Start recording" : "Choose screen or window",
                recording: "Stop recording",
                starting: "Starting…",
                saving: "Saving…",
              }[phase]
            }
          </button>
        </div>
      </section>
      <Collapsible.Root className="destination">
        <Collapsible.Trigger className="destination-trigger">
          <Folder aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="text-xs text-muted">Destination</span>
            <span>
              {profile.folderName
                ? (accounts.find((a) => a.id === profile.account)?.email ||
                    "Google Drive") +
                  " / " +
                  profile.folderName
                : "Local recordings"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <fieldset disabled={!!busy || phase !== "idle"}>
            <legend>Google Drive</legend>
            {!!accounts.length && (
              <ChoiceSelect
                label="Google account"
                value={account}
                onChange={setAccount}
                disabled={!!busy || phase !== "idle"}
                options={accounts.map((a) => ({ value: a.id, label: a.email }))}
              />
            )}
            <button
              onClick={() =>
                action("Connecting…", async () => {
                  setAccount(await api.connect());
                  setAccounts(await api.accounts());
                })
              }
            >
              Connect Google account
            </button>
            {!!account && (
              <button
                disabled={!account}
                onClick={() =>
                  action("Choosing folder…", async () => {
                    await api.folder(profile.id, account);
                    await refreshProfile();
                  })
                }
              >
                Choose folder
              </button>
            )}
          </fieldset>
        </Collapsible.Content>
      </Collapsible.Root>
      <section className="library mt-6 border-t border-line pt-6">
        <h2 className="mb-4 font-display text-2xl font-medium tracking-tight">
          Recordings
        </h2>
        {preview && (
          <video
            className="mb-4 max-h-80 w-full rounded-xl bg-deep"
            controls
            src={"clip://library/" + preview}
          />
        )}
        {!videos.length && (
          <small className="block rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No recordings in {profile.name} yet.
          </small>
        )}
        {videos.map((v) => (
          <article key={v.id}>
            <time>{new Date(v.created).toLocaleString()}</time>{" "}
            <button onClick={() => play(v.id)}>Preview</button>
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
                  !!busy || phase !== "idle" || !(v.folder || profile.folder)
                }
                onClick={() =>
                  action("Uploading…", async () => {
                    await api.upload(v.id);
                    await refresh();
                  })
                }
              >
                Save to Drive
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
