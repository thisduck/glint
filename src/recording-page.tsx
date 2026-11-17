import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Check, Copy, HardDrive, Cloud } from "lucide-react";

import { ChoiceSelect } from "./components/ui/controls";
import { ClipEditor } from "./clip-editor";

const api = window.desk;
export function RecordingPage({ video, profile, onOpen, onBack, refresh }) {
  const [deleting,setDeleting]=useState(false);
  const [alsoDrive,setAlsoDrive]=useState(false);
  const [changingAccess,setChangingAccess]=useState(false);
  const [details, setDetails] = useState(null);
  const [issue, setIssue] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [checking, checkAgain] = useState(0);
  const [busy, setBusy] = useState("");
  const player = useRef<HTMLVideoElement>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!video.remote) return;
    let active = true,
      timer;
    let attempts = 0;
    async function check() {
      try {
        const info = await api.driveDetails(video.id);
        if (!active) return;
        setDetails(info);
        setLookupError(info.accessIssue || "");
        if (!info.metadata && ++attempts < 12) timer = setTimeout(check, 15000);
      } catch (error) {
        if (active) setLookupError(error.message);
      }
    }
    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [video.remote, video.uploadState, checking]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  async function run(label, fn) {
    setBusy(label);
    setIssue("");
    try {
      await fn();
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy("");
    }
  }
  const pending = video.uploadState === "pending";
  const uploading = busy === "Upload" || pending;
  const failed = video.uploadState === "failed";
  const cloudStatus = video.remote
    ? "Uploaded"
    : uploading
      ? video.progress != null
        ? "Uploading · " + video.progress + "%"
        : "Preparing upload…"
      : failed
        ? "Upload failed"
        : "Local copy only";
  return (
    <section className="mt-6">
      <button className="quiet inline-flex items-center gap-2" onClick={onBack}>
        <ArrowLeft size={15} /> Recording studio
      </button>
      <header className="my-5">
        <p className="text-sm text-muted">
          {profile.name} · {new Date(video.created).toLocaleString()}
        </p>
        {editing ? (
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run("Rename", async () => {
                await api.renameRecording(video.id, title);
                await refresh();
                setEditing(false);
              });
            }}
          >
            <input
              aria-label="Title in glint"
              placeholder="Recording title"
              autoFocus
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button disabled={!!busy || !title.trim()}>Save title</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <h2 className="break-words text-3xl font-medium tracking-tight">
              {video.title ||
                (video.captureIssue
                  ? "Recovered recording"
                  : "Recording saved")}
            </h2>
            <button
              className="quiet"
              onClick={() => {
                setTitle(video.title || "");
                setEditing(true);
              }}
            >
              {video.title ? "Edit title" : "Add title"}
            </button>
          </div>
        )}
        {video.durationMs > 0 && (
          <p className="mt-1 text-sm text-muted">
            {Math.floor(video.durationMs / 60000)}m{" "}
            {Math.floor(video.durationMs / 1000) % 60}s
          </p>
        )}
      </header>
      <video
        ref={player}
        controls
        playsInline
        preload="metadata"
        aria-label="Local recording"
        src={"clip://library/" + video.id}
        className="aspect-video max-h-[48vh] w-full rounded-xl bg-deep"
      />
      <div className="my-4 flex flex-wrap items-center gap-2">
        {video.remote && (
          <button
            className="inline-flex items-center gap-2 bg-accent px-4 font-semibold text-white"
            disabled={!!busy}
            onClick={() =>
              run("Copy", async () => {
                await api.share(video.id, true);
                setCopied(true);
              })
            }
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        <button onClick={() => run("Finder", () => api.reveal(video.id))}>
          Show in Finder
        </button>
        {video.remote && (
          <button
            onClick={() => run("Drive", () => api.share(video.id, false))}
          >
            Open in Drive
          </button>
        )}
        {(!video.remote || failed) && (profile.folder || video.folder) && (
          <button
            disabled={!!busy || pending}
            onClick={() =>
              run("Upload", async () => {
                try {
                  await api.upload(video.id);
                } finally {
                  await refresh();
                }
              })
            }
          >
            {uploading
              ? "Working…"
              : video.remote
                ? "Retry sharing"
                : failed
                  ? "Retry upload"
                  : "Upload to Drive"}
          </button>
        )}
      </div>
      <ClipEditor
        video={video}
        player={player}
        busy={busy}
        onSave={(start, end,cuts) =>
          run("Trim", async () => {
            const id = await api.trimRecording(video.id, start, end,cuts);
            await refresh();
            onOpen(id);
          })
        }
      />
      <dl className="destination divide-y divide-line px-5" aria-live="polite">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="flex items-center gap-2">
            <HardDrive size={16} /> Local copy
          </dt>
          <dd>Saved on this Mac</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="flex items-center gap-2">
            <Cloud size={16} /> Google Drive
          </dt>
          <dd>{cloudStatus}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <dt>{video.remote ? "Link sharing" : "Access on upload"}</dt>
          <dd>{video.remote && !changingAccess ? <button disabled={!!busy || pending} onClick={()=>setChangingAccess(true)}>Change link access</button> :
            <ChoiceSelect label="Access for this recording" disabled={!!busy || pending}
              value={video.remote ? "" : video.privacy}
              options={video.remote ? [{value:"folder",label:"Restricted · existing people only"},{value:"link",label:"Anyone with the link · viewer"}] : [{value:"private",label:"Private · only me"},{value:"folder",label:"Use folder access"},{value:"link",label:"Anyone with the link"}]}
              onChange={value=>run("Sharing",async()=>{
                try {await api.setFileAccess(video.id,value);setChangingAccess(false);}
                finally {checkAgain(n=>n+1);await refresh();}
              })}/>}
          </dd>
        </div>
        {video.remote && (
          <>
            <div className="flex justify-between gap-4 py-3">
              <dt>Link access</dt>
              <dd>
                {pending
                  ? "Applying sharing…"
                  : lookupError
                    ? "Access unavailable"
                    : details?.access || "Checking…"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt>Drive playback</dt>
              <dd>
                {details?.metadata
                  ? "Video metadata available"
                  : "Readiness unconfirmed"}
              </dd>
            </div>
          </>
        )}
      </dl>
      {video.remote && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p>Open in Drive to check playback.</p>
          <button className="quiet" onClick={() => checkAgain((n) => n + 1)}>
            Refresh status
          </button>
        </div>
      )}
      <div className="my-5 border-t border-line pt-4">
        {deleting ? <div className="grid justify-items-start gap-3">
          <h3 className="font-semibold">Move this recording to Trash?</h3>
          <p className="text-muted">Removes the recording from glint and moves the local video to this Mac’s Trash.</p>
          {video.remote && <label className="flex items-center gap-2"><input type="checkbox" checked={alsoDrive} disabled={!!busy} onChange={e=>setAlsoDrive(e.target.checked)}/>Also move the uploaded video to Drive Trash</label>}
          <div className="flex gap-2"><button disabled={!!busy || pending} onClick={()=>run("Delete",async()=>{
            player.current.pause();await api.deleteRecording(video.id,alsoDrive);onBack();await refresh();
          })}>Move to Trash</button><button disabled={!!busy} onClick={()=>{setDeleting(false);setAlsoDrive(false);}}>Cancel</button></div>
        </div> : <button className="quiet" disabled={!!busy || pending} onClick={()=>setDeleting(true)}>Delete recording…</button>}
      </div>
      {(issue || video.captureIssue || video.uploadError || lookupError) && (
        <details open className="destination p-4">
          <summary className="cursor-pointer font-medium">
            Recording issues
          </summary>
          <dl className="mt-3 grid gap-2 text-sm">
            {[
              ["Capture", video.captureIssue],
              [video.remote ? "Sharing" : "Upload", video.uploadError],
              ["Drive status", lookupError],
              ["Last action", issue],
            ]
              .filter(([, message]) => message)
              .map(([label, message]) => (
                <div key={label}>
                  <dt className="font-medium">{label}</dt>
                  <dd className="text-muted">{message}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </section>
  );
}
