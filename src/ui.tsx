import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./studio";
import { Logo } from "./logo";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, UserRound } from "lucide-react";
const api = window.desk;
const themes = [
  { id: "lilac", name: "Lilac", font: "Baskerville" },
  { id: "grove", name: "Grove", font: "Avenir Next" },
  { id: "clay", name: "Clay", font: "Georgia" },
  { id: "cobalt", name: "Cobalt", font: "Helvetica Neue" },
  { id: "marigold", name: "Marigold", font: "Palatino" },
  { id: "midnight", name: "Midnight", font: "Menlo" },
];
function App() {
  const [theme, setTheme] = useState(
    () => themes.find((t) => t.id === localStorage.appearance)?.id || "cobalt",
  );
  const [profiles, setProfiles] = useState([]),
    [id, select] = useState(Number(localStorage.profile) || 1);
  const [edit, setEdit] = useState(null),
    [name, setName] = useState(""),
    [error, fail] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [locked, lock] = useState(false);
  async function refresh() {
    setProfiles(await api.profiles());
  }
  useEffect(() => {
    refresh().catch((e) => fail(e.message));
  }, []);
  const profile = profiles.find((p) => p.id === id) || profiles[0];
  function choose(value) {
    setSettingsOpen(false);
    select(value);
    localStorage.profile = String(value);
    setEdit(null);
    fail("");
  }
  async function save(e) {
    e.preventDefault();
    try {
      const next = await api.save(name, edit);
      await refresh();
      choose(next);
    } catch (e) {
      fail(e.message);
    }
  }
  return (
    <main
      data-theme={theme}
      className="min-h-screen bg-rail font-sans text-ink"
    >
      <div className="mx-auto w-full max-w-[840px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="flex shrink-0 items-center gap-2 font-display text-2xl leading-none tracking-tight">
            <Logo />
            snow white
          </h1>
          <Popover.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Popover.Trigger
              disabled={locked}
              aria-label={`Profile settings: ${profile?.name || "Profiles"}`}
              className="choice-trigger"
            >
              <UserRound />
              <span className="truncate">{profile?.name || "Profiles"}</span>
              <ChevronDown />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                collisionPadding={12}
                aria-label="Profile settings"
                className="profile-settings"
              >
                <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted">
                  Profiles
                </h2>
                <nav className="grid gap-1" aria-label="Profiles">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      className="profile-tab"
                      aria-current={p.id === profile?.id ? "true" : undefined}
                      disabled={locked}
                      onClick={() => choose(p.id)}
                    >
                      <span aria-hidden="true">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      {p.name}
                    </button>
                  ))}
                </nav>
                <div className="mt-2 flex flex-wrap gap-1 ">
                  <button
                    className="quiet"
                    disabled={locked}
                    onClick={() => {
                      setEdit(0);
                      setName("");
                    }}
                  >
                    Add profile
                  </button>
                  <button
                    className="quiet"
                    disabled={locked || !profile}
                    onClick={() => {
                      setEdit(profile.id);
                      setName(profile.name);
                    }}
                  >
                    Rename
                  </button>
                </div>
                {!locked && edit !== null && (
                  <form className="mt-3 flex flex-wrap gap-2" onSubmit={save}>
                    <input
                      autoFocus
                      required
                      maxLength={100}
                      aria-label="Profile name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button>Save</button>
                    <button type="button" onClick={() => setEdit(null)}>
                      Cancel
                    </button>
                  </form>
                )}
                <details className="appearance mt-4 border-t border-line pt-2">
                  <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-medium">
                    Appearance <ChevronDown className="size-4" />
                  </summary>
                  <div className="space-y-1">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        data-theme={t.id}
                        className="theme-choice text-ink"
                        aria-label={t.name + ", " + t.font}
                        aria-pressed={theme === t.id}
                        onClick={() => {
                          setTheme(t.id);
                          localStorage.appearance = t.id;
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 rounded-full bg-glass ring-1 ring-black/10"
                        />
                        {t.name}
                        <small className="ml-auto font-sans text-[10px] text-muted">
                          {t.font}
                        </small>
                      </button>
                    ))}
                  </div>
                </details>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </header>
        <div>
          <h2 className="mb-4 mt-7 font-display text-2xl font-medium tracking-tight">
            Recording studio
          </h2>
        </div>
        {profile && (
          <Studio
            key={profile.id}
            profile={profile}
            refreshProfile={refresh}
            lock={lock}
            fail={fail}
          />
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
