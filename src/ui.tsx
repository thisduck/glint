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
      <header>
        <h1>cinderella</h1>
        <span>Recording studio</span>
      </header>
      <section>
        <label>
          Profile{" "}
          <select
            disabled={locked}
            value={profile?.id || ""}
            onChange={(e) => choose(Number(e.target.value))}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
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
      </section>
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
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
