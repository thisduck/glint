import React, { useEffect, useState, useRef } from "react";
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
      <section className="console">
        <div className="stage">
          <div className="monitor" aria-hidden="true">
            <i />
          </div>
          <h3>
            {sources.find((s) => s.id === source)?.name ||
              "Choose a capture source"}
          </h3>
          {phase === "recording" && (
            <span role="status">Recording in progress</span>
          )}
          <button disabled={phase !== "idle"} onClick={load}>
            {sources.length ? "Refresh sources" : "Choose screen or window"}
          </button>
          {!!sources.length && (
            <select
              aria-label="Capture source"
              disabled={phase !== "idle"}
              value={source}
              onChange={(e) => choose(e.target.value)}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="transport">
          <label>
            <input
              type="checkbox"
              checked={mic}
              disabled={phase !== "idle"}
              onChange={(e) => setMic(e.target.checked)}
            />
            Microphone
          </label>
          <button
            className="primary"
            disabled={
              !!busy || (phase === "idle" ? !source : phase !== "recording")
            }
            onClick={() =>
              phase === "recording" ? recorder.current.stop() : start()
            }
          >
            {
              {
                idle: "Start recording",
                recording: "Stop recording",
                starting: "Starting…",
                saving: "Saving…",
              }[phase]
            }
          </button>
        </div>
      </section>
      <details className="destination">
        <summary>
          <strong>Destination</strong>
          <span>
            {profile.folderName
              ? (accounts.find((a) => a.id === profile.account)?.email ||
                  "Google Drive") +
                " / " +
                profile.folderName
              : "Local recordings"}
          </span>
        </summary>
        <fieldset disabled={!!busy || phase !== "idle"}>
          <legend>Google Drive</legend>
          <select
            aria-label="Google account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
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
        </fieldset>
      </details>
      <section className="library">
        <h2>Recordings</h2>
        {preview && <video controls src={"clip://library/" + preview} />}
        {!videos.length && (
          <small>Your recordings for {profile.name} will appear here.</small>
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
