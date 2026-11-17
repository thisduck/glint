import React from "react";
export const symbols = [
  "Glass slipper",
  "Pumpkin coach",
  "Midnight clock",
  "Fairy wand",
];
export function LogoShapes() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <symbol id="mark-glass-slipper" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              fill="var(--tint)"
              d="M4 17c3 2 5 7 10 9 3 1 5-2 7-4 2 3 4 4 8 5 3 1 3 4 0 5h-9c-5 0-7-7-12-9l-1 9H5l-1-10z"
            />
            <path
              d="m21 13 1.4-3.5 1.4 3.5 3.2 1.3-3.2 1.3-1.4 3.4-1.4-3.4-3.2-1.3z"
              fill="var(--shine)"
            />
          </g>
        </symbol>
        <symbol id="mark-pumpkin-coach" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 12q-1-5 4-5" />
            <path
              fill="var(--tint)"
              d="M4 23c0-8 6-12 13-10 8-3 14 3 13 10-1 5-5 7-13 7S5 28 4 23Z"
            />
            <path d="M13 26v-5q0-6 4-6t4 6v5z" />
            <circle cx="9" cy="31" r="4" fill="var(--paper)" />
            <circle cx="25" cy="31" r="4" fill="var(--paper)" />
          </g>
        </symbol>
        <symbol id="mark-midnight-clock" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="17" cy="22" r="14" fill="var(--tint)" />
            <path d="M17 11v11l-3-9m-8 9h2m18 0h2m-11 9v2" />
            <circle cx="17" cy="22" r="1.3" fill="currentColor" />
          </g>
        </symbol>
        <symbol id="mark-fairy-wand" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 35 15-18m-13 18 14-17" />
            <path
              fill="var(--tint)"
              d="m21 6 2.7 5.4 6 .8-4.3 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6-.8z"
            />
            <path d="m6 10 0 5m-2.5-2.5h5M28 27v4m-2-2h4" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}
export function Logo({ name }: { name: string }) {
  return (
    <svg
      className="h-9 w-7 shrink-0 text-ink"
      viewBox="0 0 34 42"
      aria-hidden="true"
    >
      <use href={"#mark-" + name.toLowerCase().replaceAll(" ", "-")} />
    </svg>
  );
}
