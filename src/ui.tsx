import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./studio";
const api = window.desk;
function App() {
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
    <main>
      <aside>
        <h1>
          <i aria-hidden="true" className="brand-mark" />
          cinderella
        </h1>
        <h2 className="rail-label">Profiles</h2>
        <nav aria-label="Profiles">
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
        <div className="profile-actions">
          <button
            disabled={locked}
            onClick={() => {
              setEdit(0);
              setName("");
            }}
          >
            Add profile
          </button>
          <button
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
          <form onSubmit={save}>
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
      </aside>
      <div className="workspace">
        <header>
          <h2>Recording studio</h2>
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
