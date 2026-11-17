import React, { useEffect, useRef, useState } from "react";
import { Monitor, AppWindow } from "lucide-react";

export type CaptureSource = {
  id: string;
  name: string;
  thumbnail: string | null;
};

export function SourcePicker({
  current,
  onChoose,
  onCancel,
}: {
  current: CaptureSource | null;
  onChoose: (source: CaptureSource) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<CaptureSource[]>([]);
  const [message, setMessage] = useState("Loading screens and windows…");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let active = true;
    setMessage("Loading screens and windows…");
    setItems([]);
    window.desk
      .sources()
      .then((sources: CaptureSource[]) => {
        if (!active) return;
        setItems(sources);
        setMessage(
          sources.length
            ? ""
            : "No capture sources found. Check Screen Recording access in System Settings.",
        );
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="source-heading"
      onCancel={onCancel}
      className="m-auto w-[min(640px,calc(100%-2rem))] max-h-[80vh] rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/45"
    >
      <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-line bg-paper px-5 py-4">
        <h2 id="source-heading" className="font-display text-xl font-medium">
          Choose a capture source
        </h2>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <div className="p-5">
        {message && <p role="status">{message}</p>}
        {["Screen", "Window"].map((kind) => {
          const group = items.filter(
            (s) => (s.id.startsWith("screen:") ? "Screen" : "Window") === kind,
          );
          const Icon = kind === "Screen" ? Monitor : AppWindow;
          if (!group.length) return null;
          return (
            <section key={kind} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-muted">{kind}s</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => onChoose(s)}
                    aria-pressed={s.id === current?.id}
                    className="grid min-w-0 gap-2 p-2 text-left aria-pressed:border-accent"
                  >
                    <span className="grid aspect-video place-items-center overflow-hidden rounded-md bg-rail">
                      {s.thumbnail ? (
                        <img
                          src={s.thumbnail}
                          alt=""
                          className="size-full object-contain"
                        />
                      ) : (
                        <Icon aria-hidden="true" />
                      )}
                    </span>
                    <span className="break-words px-1 text-sm font-medium">
                      {s.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        <button type="button" onClick={() => refresh((v) => v + 1)}>
          Refresh list
        </button>
      </div>
    </dialog>
  );
}
