import React, { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
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
  const [tab, setTab] = useState(
    current?.id.startsWith("window:") ? "Window" : "Screen",
  );
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let active = true;
    setMessage("Loading screens and windows…");
    setItems([]);
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      let delay = 900;
      try {
        const sources = await window.desk.sources(tab.toLowerCase());
        if (!active) return;
        setItems(sources);
        setMessage("");
      } catch (error) {
        if (!active) return;
        setMessage(error.message);
        delay = 4000;
      }
      timer = setTimeout(update, delay);
    }
    update();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="source-heading"
      onCancel={onCancel}
      className="m-auto w-[min(640px,calc(100%-2rem))] max-h-[80vh] overflow-hidden rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/45"
    >
      <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-line bg-paper px-5 py-4">
        <h2 id="source-heading" className="font-display text-xl font-medium">
          Choose a capture source
        </h2>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <Tabs.Root
        value={tab}
        onValueChange={setTab}
        className="flex max-h-[calc(80vh-5rem)] flex-col"
      >
        <Tabs.List
          aria-label="Capture source type"
          className="mx-5 mt-3 grid shrink-0 grid-cols-2 rounded-lg bg-rail p-1"
        >
          {["Screen", "Window"].map((kind) => (
            <Tabs.Trigger
              key={kind}
              value={kind}
              className="rounded-md border-0 bg-transparent data-[state=active]:bg-paper data-[state=active]:shadow-sm"
            >
              {kind}s
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="min-h-0 overflow-y-auto p-5">
          {message && <p role="status">{message}</p>}
          {["Screen", "Window"].map((kind) => {
            const group = items.filter(
              (s) =>
                (s.id.startsWith("screen:") ? "Screen" : "Window") === kind,
            );
            const Icon = kind === "Screen" ? Monitor : AppWindow;

            return (
              <Tabs.Content key={kind} value={kind} className="mb-4">
                {!group.length && !message && (
                  <p role="status">No {kind.toLowerCase()}s available.</p>
                )}
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
              </Tabs.Content>
            );
          })}
        </div>
      </Tabs.Root>
    </dialog>
  );
}
