import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Cloud,
  CloudUpload,
  Film,
  HardDrive,
  Link2,
} from "lucide-react";
import { RecordingThumbnail } from "./recording-thumbnail";

export function RecordingLibrary({
  videos,
  profile,
  disabled,
  onOpen,
  onCopy,
  onViewDrive,
  onUpload,
}) {
  const [copy, setCopy] = useState<{ id: string; state: "busy" | "done" | "error" } | null>(null);
  useEffect(() => {
    if (!copy || copy.state === "busy") return;
    const t = setTimeout(() => setCopy(null), 2500);
    return () => clearTimeout(t);
  }, [copy]);
  async function copyLink(id) {
    setCopy({ id, state: "busy" });
    try {
      await onCopy(id);
      setCopy({ id, state: "done" });
    } catch {
      setCopy({ id, state: "error" });
    }
  }
  return (
    <section className="mt-8" aria-labelledby="recordings-heading">
      <h2
        id="recordings-heading"
        className="mb-3 font-display text-2xl font-medium tracking-tight"
      >
        Recordings
      </h2>
      {videos.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
          <Film className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-sm text-muted">
            No recordings in {profile.name} yet.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
          {videos.map((video) => {
            const title =
              video.title ||
              (video.captureIssue ? "Recovered recording" : "Screen recording");
            const date = new Date(video.created).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const pending = video.uploadState === "pending";
            const failed = video.uploadState === "failed";
            const storage = video.remote
              ? pending
                ? "Applying link access"
                : failed
                  ? "Link access setup failed"
                  : "In Google Drive"
              : pending
                ? "Uploading to Drive"
                : failed
                  ? "Drive upload failed"
                  : "On this Mac";
            const StorageIcon =
              video.remote || pending || failed ? Cloud : HardDrive;
            return (
              <li
                key={video.id}
                className="flex flex-col gap-1 p-2 sm:flex-row sm:items-center sm:gap-3 sm:p-3"
              >
                <button
                  className="group flex w-full min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-1.5 text-left"
                  aria-label={`Open ${title}, ${date}`}
                  disabled={disabled}
                  onClick={() => onOpen(video.id)}
                >
                  <RecordingThumbnail video={video} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {title}
                    </span>
                    <time
                      dateTime={video.created}
                      className="mt-0.5 block text-xs text-muted"
                    >
                      {date}
                    </time>
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                      <StorageIcon
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {storage}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted group-hover:text-accent"
                    aria-hidden="true"
                  />
                </button>
                <div className="flex shrink-0 items-center justify-end gap-1.5 px-1.5 sm:px-0">
                  {video.remote ? (
                    <>
                      <button
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        disabled={disabled || copy?.id === video.id}
                        aria-label={`Copy link for ${title}, ${date}`}
                        onClick={() => copyLink(video.id)}
                      >
                        {copy?.id === video.id && copy.state === "done" ? (
                          <Check className="size-3.5 text-accent" aria-hidden="true" />
                        ) : (
                          <Link2 className="size-3.5" aria-hidden="true" />
                        )}
                        <span aria-live="polite">
                          {copy?.id !== video.id
                            ? "Copy link"
                            : copy.state === "busy"
                              ? "Copying…"
                              : copy.state === "done"
                                ? "Copied"
                                : "Copy failed"}
                        </span>
                      </button>
                      <button
                        className="grid size-9 place-items-center p-0"
                        title="Open in Drive"
                        aria-label={`Open ${title}, ${date} in Drive`}
                        disabled={disabled}
                        onClick={() => onViewDrive(video.id)}
                      >
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    !pending &&
                    (video.folder || profile.folder) && (
                      <button
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        disabled={disabled}
                        onClick={() => onUpload(video.id)}
                      >
                        <CloudUpload className="size-3.5" aria-hidden="true" />
                        {failed ? "Retry upload" : "Upload to Drive"}
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
