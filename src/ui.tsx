import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./studio";
import { mirrors, MirrorShapes, Mirror } from "./mirrors";
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
  const [mark, setMark] = useState(() =>
    mirrors.includes(localStorage.mirror) ? localStorage.mirror : "Wall mirror",
  );
  const [profiles, setProfiles] = useState([]),
    [id, select] = useState(Number(localStorage.profile) || 1);
  const [edit, setEdit] = useState(null),
    [name, setName] = useState(""),
    [error, fail] = useState("");
  const [locked, lock] = useState(false);
  async function refresh() {
    setProfiles(await api.profiles());
  }
  useEffect(() => {
    refresh().catch((e) => fail(e.message));
  }, []);
  const profile = profiles.find((p) => p.id === id) || profiles[0];
  function choose(value) {
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
      className="min-h-screen bg-paper font-sans text-ink md:grid md:grid-cols-[204px_minmax(0,1fr)]"
    >
      <aside className="flex flex-col border-b border-line bg-rail p-5 md:min-h-screen md:border-b-0 md:border-r md:py-8">
        <h1 className="mb-6 flex items-center gap-2 text-[29px] font-display font-medium leading-none tracking-tight md:mb-12">
          <MirrorShapes />
          <Mirror name={mark} />
          cinderella
        </h1>
        <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted">
          Profiles
        </h2>
        <nav
          className="grid grid-cols-2 gap-1 md:grid-cols-1"
          aria-label="Profiles"
        >
          {profiles.map((p) => (
            <button
              key={p.id}
              className="profile-tab"
              aria-current={p.id === profile?.id ? "true" : undefined}
              disabled={locked}
              onClick={() => choose(p.id)}
            >
              <span aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
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
        <details className="mt-5 border-t border-line pt-3 md:mt-auto">
          <summary className="cursor-pointer py-2 text-sm font-medium">
            Appearance
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
          <fieldset className="mt-3 grid grid-cols-2 gap-1">
            <legend className="py-2 font-semibold">Mirror logo</legend>
            {mirrors.map((name) => (
              <button
                key={name}
                aria-pressed={mark === name}
                onClick={() => {
                  setMark(name);
                  localStorage.mirror = name;
                }}
                className="flex flex-col items-center justify-center gap-1 px-1 text-xs aria-pressed:bg-tint"
              >
                <Mirror name={name} />
                {name}
              </button>
            ))}
          </fieldset>
        </details>
      </aside>
      <div className="mx-auto w-full min-w-0 max-w-5xl px-5 py-7 sm:px-8 lg:p-12">
        <header>
          <h2 className="mb-6 font-display text-4xl font-medium tracking-tight lg:text-5xl">
            Recording studio
          </h2>
        </header>
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
