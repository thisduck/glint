import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { loadProfiles } from "./capture-preferences.mjs";
import { Studio } from "./studio";
import { Logo } from "./logo";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, ChevronDown, Pencil, Plus, UserRound } from "lucide-react";
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
  const [edit, setEdit] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, fail] = useState("");
  const [profileError, setProfileError] = useState("");
  const [saving, setSaving] = useState(false);
  const profilesTab = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [locked, lock] = useState(false);
  async function refresh() {
    setProfiles(await loadProfiles(api, localStorage));
  }
  useEffect(() => {
    refresh().catch((e) => fail(e.message));
  }, []);
  const profile = profiles.find((p) => p.id === id) || profiles[0];
  function updateSettingsOpen(open: boolean) {
    if (saving) return;
    setSettingsOpen(open);
    if (!open) cancelEdit();
  }
  function beginEdit(id: number, value: string) {
    setProfileError("");
    setEdit(id);
    setName(value);
  }
  function cancelEdit() {
    setProfileError("");
    setEdit(null);
  }
  function choose(value) {
    setSettingsOpen(false);
    select(value);
    localStorage.profile = String(value);
    cancelEdit();
    fail("");
  }
  async function save(e) {
    e.preventDefault();
    if (locked || saving || edit === null || !name.trim()) return;
    setSaving(true);
    setProfileError("");
    try {
      const next = await api.save(name.trim(), edit);
      try {
        await refresh();
        choose(next);
      } catch (e) {
        choose(next);
        fail(e.message);
      }
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <main
      data-theme={theme}
      className="min-h-screen bg-rail font-sans text-ink"
    >
      <div className="mx-auto w-full max-w-[840px] px-5 py-4 sm:px-8 sm:py-5">
        <header className="flex items-center justify-between gap-4">
          <h1 className="flex shrink-0 items-center gap-2 font-display text-2xl leading-none tracking-tight">
            <Logo />
            glint
          </h1>
          <Popover.Root open={settingsOpen} onOpenChange={updateSettingsOpen}>
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
                <Tabs.Root defaultValue="profiles" onValueChange={cancelEdit}>
                  <Tabs.List
                    aria-label="Settings"
                    className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-tint p-1"
                  >
                    <Tabs.Trigger
                      ref={profilesTab}
                      value="profiles"
                      disabled={saving}
                      className="border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-paper data-[state=active]:text-ink"
                    >
                      Profiles
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="appearance"
                      disabled={saving}
                      className="border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-paper data-[state=active]:text-ink"
                    >
                      Appearance
                    </Tabs.Trigger>
                  </Tabs.List>
                  <Tabs.Content value="profiles">
                    {edit === null ? (
                      <>
                        <nav
                          className="grid max-h-48 gap-1 overflow-y-auto p-1"
                          aria-label="Profiles"
                        >
                          {profiles.map((p) => (
                            <button
                              key={p.id}
                              className="profile-tab"
                              aria-current={
                                p.id === profile?.id ? "true" : undefined
                              }
                              disabled={locked || saving}
                              onClick={() => choose(p.id)}
                            >
                              <span aria-hidden="true">
                                {p.name.slice(0, 1).toUpperCase()}
                              </span>
                              <strong className="min-w-0 flex-1 [font-weight:inherit]">
                                {p.name}
                              </strong>
                              {p.id === profile?.id && (
                                <Check
                                  className="size-4 shrink-0 text-accent"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ))}
                        </nav>
                        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                          <button
                            className="quiet inline-flex items-center gap-1.5 text-sm text-ink"
                            disabled={locked || saving}
                            onClick={() => beginEdit(0, "")}
                          >
                            <Plus className="size-4" aria-hidden="true" />
                            Add profile
                          </button>
                          <button
                            className="quiet ml-auto inline-flex items-center gap-1.5 text-sm"
                            aria-label="Rename active profile"
                            disabled={locked || saving || !profile}
                            onClick={() => beginEdit(profile.id, profile.name)}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Rename
                          </button>
                        </div>
                      </>
                    ) : (
                      <form className="grid gap-3" onSubmit={save}>
                        <h2 className="text-sm font-semibold">
                          {edit === 0 ? "Add profile" : "Rename profile"}
                        </h2>
                        <div className="grid gap-1.5">
                          <label
                            htmlFor="profile-name"
                            className="text-xs font-medium text-muted"
                          >
                            Profile name
                          </label>
                          <input
                            id="profile-name"
                            autoFocus
                            required
                            maxLength={100}
                            disabled={locked || saving}
                            aria-invalid={Boolean(profileError) || undefined}
                            aria-describedby={
                              profileError ? "profile-error" : undefined
                            }
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              setProfileError("");
                            }}
                          />
                        </div>
                        {profileError && (
                          <p
                            id="profile-error"
                            role="alert"
                            className="mt-0 text-sm"
                          >
                            {profileError}
                          </p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="quiet text-sm"
                            disabled={saving}
                            onClick={() => {
                              cancelEdit();
                              profilesTab.current?.focus();
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="border-0 bg-accent font-semibold text-white hover:bg-deep"
                            disabled={locked || saving || !name.trim()}
                          >
                            {saving
                              ? "Saving…"
                              : edit === 0
                                ? "Create profile"
                                : "Save name"}
                          </button>
                        </div>
                      </form>
                    )}
                  </Tabs.Content>
                  <Tabs.Content
                    value="appearance"
                    className="grid gap-1 data-[state=inactive]:hidden"
                  >
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        className="theme-choice text-ink"
                        aria-pressed={theme === t.id}
                        onClick={() => {
                          setTheme(t.id);
                          localStorage.appearance = t.id;
                        }}
                      >
                        <span
                          aria-hidden="true"
                          data-theme={t.id}
                          className="size-4 shrink-0 rounded-full bg-glass ring-1 ring-black/10"
                        />
                        <span className="grid flex-1 gap-0.5">
                          <span data-theme={t.id} className="font-display">
                            {t.name}
                          </span>
                          <small className="font-sans text-[11px] text-muted">
                            {t.font}
                          </small>
                        </span>
                        {theme === t.id && (
                          <Check
                            className="size-4 shrink-0 text-accent"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ))}
                  </Tabs.Content>
                </Tabs.Root>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </header>
        {!profile && error && <p role="alert">{error}</p>}
        {profile && (
          <Studio
            key={profile.id}
            error={error}
            profile={profile}
            profiles={profiles}
            onProfile={choose}
            refreshProfile={refresh}
            lock={lock}
            fail={fail}
          />
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
