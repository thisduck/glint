import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Cloud,
  CloudUpload,
  FolderOpen,
  HardDrive,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";

import { ChoiceSelect } from "./components/ui/controls";
import { VideoPlayer } from "./video-player";
import { ClipEditor } from "./clip-editor";

const api = window.desk;
export function RecordingPage({ video, profile, onOpen, onBack, refresh }) {
  const [deleting, setDeleting] = useState(false);
  const [alsoDrive, setAlsoDrive] = useState(false);
  const [changingAccess, setChangingAccess] = useState(false);
  const [details, setDetails] = useState(null);
  const [issue, setIssue] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [checking, checkAgain] = useState(0);
  const [busy, setBusy] = useState("");
  const [mediaLength, setMediaLength] = useState(video.durationMs / 1000 || 0);
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
    ? pending
      ? "Applying link access…"
      : failed
        ? "Link access setup failed"
        : "Uploaded"
    : uploading
      ? video.progress != null
        ? "Uploading · " + video.progress + "%"
        : "Preparing upload…"
      : failed
        ? "Upload failed"
        : "Local copy only";
  return (
    <section className="mt-6" aria-labelledby="recording-title">
      <button
        className="inline-flex items-center gap-2 border-0 bg-transparent px-2 text-sm font-medium text-muted"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to recordings
      </button>
      <header className="mb-5 mt-3">
        <p className="text-sm text-muted">
          {profile.name} ·{" "}
          <time dateTime={video.created}>
            {new Date(video.created).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
        {editing ? (
          <form
            id="recording-title"
            aria-label="Rename recording"
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
            <button
              className="border-transparent bg-accent font-semibold text-white hover:bg-deep"
              disabled={!!busy || !title.trim()}
            >
              Save title
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <h2
              id="recording-title"
              className="min-w-0 break-words font-display text-3xl font-semibold tracking-tight"
            >
              {video.title ||
                (video.captureIssue
                  ? "Recovered recording"
                  : "Screen recording")}
            </h2>
            <button
              className="inline-flex shrink-0 items-center gap-1.5 border-0 bg-transparent text-xs font-medium text-muted"
              onClick={() => {
                setTitle(video.title || "");
                setEditing(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" /> Rename
            </button>
          </div>
        )}
        <p
          role="status"
          className={
            "mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-sm " +
            (video.captureIssue || failed
              ? "border-amber-400 bg-amber-50 text-amber-900"
              : "border-line bg-paper")
          }
        >
          <Check className="size-4 text-accent" aria-hidden="true" />
          <span className="font-semibold">Saved</span>
          {mediaLength > 0 && (
            <span className="tabular-nums">
              · {Math.floor(mediaLength / 60)}:
              {String(Math.floor(mediaLength) % 60).padStart(2, "0")}
            </span>
          )}
          <span>· {cloudStatus}</span>
          {video.captureIssue && <span>· {video.captureIssue}</span>}
        </p>
      </header>
      {issue && (
        <p role="alert" className="mb-4">
          {issue}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <VideoPlayer video={video} player={player} mediaLength={mediaLength}>
            <ClipEditor
              onDuration={setMediaLength}
              video={video}
              player={player}
              busy={busy}
              onSave={(start, end, cuts) =>
                run("Trim", async () => {
                  const id = await api.trimRecording(
                    video.id,
                    start,
                    end,
                    cuts,
                  );
                  await refresh();
                  onOpen(id);
                })
              }
            />
          </VideoPlayer>
        </div>
        <aside
          aria-labelledby="storage-heading"
          className="min-w-0 rounded-xl border border-line bg-paper px-4 py-4"
        >
          <h3
            id="storage-heading"
            className="mb-4 text-lg font-semibold tracking-tight"
          >
            Storage and sharing
          </h3>
          {(video.remote || uploading) && (
            <button
              className="mb-4 inline-flex w-full items-center justify-center gap-2 border-transparent bg-accent font-semibold text-white hover:bg-deep disabled:opacity-70"
              disabled={!!busy || pending || !video.remote}
              onClick={() =>
                run("Copy", async () => {
                  await api.share(video.id, true);
                  setCopied(true);
                })
              }
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
              <span aria-live="polite">
                {copied
                  ? "Link copied"
                  : pending || !video.remote
                    ? video.progress != null
                      ? `Copy link · uploading ${video.progress}%`
                      : "Copy link · preparing…"
                    : "Copy link"}
              </span>
            </button>
          )}
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HardDrive
                  className="size-4 shrink-0 text-muted"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">Local copy</p>
                  <p className="text-xs text-muted">Saved on this Mac</p>
                </div>
              </div>
              <button
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                disabled={!!busy}
                onClick={() => run("Finder", () => api.reveal(video.id))}
              >
                <FolderOpen className="size-3.5" aria-hidden="true" /> Show in
                Finder
              </button>
            </div>
            <div className="border-t border-line pt-4">
              <div className="flex items-center gap-2.5">
                <Cloud
                  className="size-4 shrink-0 text-muted"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">Google Drive</p>
                  <p aria-live="polite" className="text-xs text-muted">
                    {cloudStatus}
                  </p>
                </div>
              </div>
              {video.remote && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    disabled={!!busy}
                    onClick={() =>
                      run("Drive", () => api.share(video.id, false))
                    }
                  >
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />{" "}
                    Open in Drive
                  </button>
                </div>
              )}
              {(!video.remote || failed) &&
                (profile.folder || video.folder) && (
                  <button
                    className="mt-3 inline-flex items-center gap-1.5 border-transparent bg-accent text-xs font-semibold text-white hover:bg-deep"
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
                    <CloudUpload className="size-3.5" aria-hidden="true" />
                    {uploading
                      ? "Uploading…"
                      : video.remote
                        ? "Retry sharing"
                        : failed
                          ? "Retry upload"
                          : "Upload to Drive"}
                  </button>
                )}
            </div>
          </div>
          {(video.remote || profile.folder || video.folder) && (
            <dl
              className="mt-4 divide-y divide-line border-t border-line text-sm"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <dt className="font-medium">
                  {video.remote ? "Link access" : "Access on upload"}
                </dt>
                <dd className="min-w-0 text-muted">
                  {video.remote && !changingAccess ? (
                    pending ? (
                      "Applying sharing…"
                    ) : lookupError ? (
                      "Access unavailable"
                    ) : (
                      details?.access || "Checking…"
                    )
                  ) : (
                    <ChoiceSelect
                      label="Access for this recording"
                      disabled={!!busy || pending}
                      value={video.remote ? "" : video.privacy}
                      options={
                        video.remote
                          ? [
                              {
                                value: "folder",
                                label: "Restricted · existing people only",
                              },
                              {
                                value: "link",
                                label: "Anyone with the link · viewer",
                              },
                            ]
                          : [
                              { value: "private", label: "Private · only me" },
                              { value: "folder", label: "Use folder access" },
                              { value: "link", label: "Anyone with the link" },
                            ]
                      }
                      onChange={(value) =>
                        run("Sharing", async () => {
                          try {
                            await api.setFileAccess(video.id, value);
                            setChangingAccess(false);
                          } finally {
                            checkAgain((n) => n + 1);
                            await refresh();
                          }
                        })
                      }
                    />
                  )}
                </dd>
              </div>
              {video.remote && (
                <>
                  {!changingAccess && (
                    <div className="py-2">
                      <dt className="sr-only">Sharing settings</dt>
                      <dd>
                        <button
                          className="quiet"
                          disabled={!!busy || pending}
                          onClick={() => setChangingAccess(true)}
                        >
                          Change link access
                        </button>
                      </dd>
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <dt className="font-medium">Drive playback</dt>
                    <dd className="text-xs text-muted">
                      {details?.metadata
                        ? "Video metadata available"
                        : "Check playback in Drive"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          )}
          {video.remote && (
            <button className="quiet" onClick={() => checkAgain((n) => n + 1)}>
              Refresh Drive status
            </button>
          )}
          <div className="mt-3 border-t border-line pt-3">
            {deleting ? (
              <div className="grid justify-items-start gap-3">
                <h3 className="font-semibold">Move this recording to Trash?</h3>
                <p className="text-muted">
                  Removes the recording from glint and moves the local video to
                  this Mac’s Trash.
                </p>
                {video.remote && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alsoDrive}
                      disabled={!!busy}
                      onChange={(e) => setAlsoDrive(e.target.checked)}
                    />
                    Also move the uploaded video to Drive Trash
                  </label>
                )}
                <div className="flex gap-2">
                  <button
                    className="border-red-700 bg-red-700 font-semibold text-white hover:bg-red-800"
                    disabled={!!busy || pending}
                    onClick={() =>
                      run("Delete", async () => {
                        player.current?.pause();
                        await api.deleteRecording(video.id, alsoDrive);
                        onBack();
                        await refresh();
                      })
                    }
                  >
                    {busy === "Delete" ? "Moving to Trash…" : "Move to Trash"}
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() => {
                      setDeleting(false);
                      setAlsoDrive(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="quiet inline-flex items-center gap-1.5"
                disabled={!!busy || pending}
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" /> Move to
                Trash…
              </button>
            )}
          </div>
        </aside>
      </div>
      {(video.captureIssue || video.uploadError || lookupError) && (
        <details open className="destination p-4">
          <summary className="cursor-pointer font-medium">
            Recording issues
          </summary>
          <dl className="mt-3 grid gap-2 text-sm">
            {[
              ["Capture", video.captureIssue],
              [video.remote ? "Sharing" : "Upload", video.uploadError],
              ["Drive status", lookupError],
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
