# glint — agent notes

## Look and feel

glint's default appearance is **Cobalt** (`src/ui.tsx` falls back to `"cobalt"`). Use it for
marketing, screenshots, videos, mockups and docs. The `:root` block in `src/style.css` shares
Lilac's values only as a pre-theme fallback; Cobalt is what people see.

Cobalt tokens, from `[data-theme="cobalt"]` in `src/style.css`:

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#f5f8ff` | Cards, panels, inputs |
| `--rail` | `#eaf0ff` | Page background, segmented controls |
| `--ink` | `#17284c` | Primary text |
| `--muted` | `#4c6082` | Secondary text, icons, switch off |
| `--line` | `#cbd8ee` | Borders and dividers |
| `--accent` | `#234db6` | Primary buttons, switch on, selection |
| `--tint` | `#d9e4ff` | Hover, selected backgrounds, icon tiles |
| `--glass` | `#96b7ff` | Highlights on dark surfaces |
| `--deep` | `#152c60` | Dark stage behind the source picker |
| `--shine` | `#deecff` | Icons and accents on dark surfaces |

- **Type:** Helvetica Neue throughout. Headings are medium weight with tight tracking; the
  wordmark beside the logo is light.
- **Dark stage** (`.source-empty`, the "Choose your recording area" panel): `--deep` with a
  radial glow of `--accent` from the top right, white text, and a white primary button.
- **Surfaces:** `--rail` page, `--paper` cards with a 1px `--line` border, rounded-xl corners,
  soft shadows.
- **Logo:** `src/logo.tsx`, a hand-mirror outline in `--ink` with the glass filled in `--tint`.
- Screenshots look a little more violet than these values because of the display's color
  profile, so take colors from the tokens rather than sampled pixels.

## Marketing videos

Show the real UI wherever possible: render the app's own pages (`src/index.html` with
`dist/ui.js`, plus `tray-panel.html`, `toolbar.html`, `countdown.html`) rather than redrawing them.
Narrate with the global `narrate` command (`~/.agents/skills/narrate`), which speaks in Adnan's
ElevenLabs voice, and time each scene to the per-scene timings in its `receipt.json`.

## Checks

`pnpm test` and `pnpm build`. See `README.md` for running, packaging and release.
