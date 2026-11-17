import React from "react";
export const mirrors = ["Hand mirror", "Arch", "Vanity", "Compact", "Ripple"];
export function MirrorShapes() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        <symbol id="mark-hand-mirror" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g
              transform="rotate(18 17 21)"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <ellipse cx="17" cy="15" rx="10" ry="12.5" fill="var(--tint)" />
              <path d="m13 16 5-7m-1 10 4-6M15 28v9a2 2 0 0 0 4 0v-9" />
            </g>
          </g>
        </symbol>
        <symbol id="mark-arch" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 35V17a11 11 0 0 1 22 0v18z" fill="var(--tint)" />
            <path d="m12 22 7-10m-4 14 4-6" />
          </g>
        </symbol>
        <symbol id="mark-vanity" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="17" cy="15" rx="9" ry="12" fill="var(--tint)" />
            <path d="M4 15a13 15 0 0 0 26 0M17 30v6m-7 2q7-4 14 0m-11-23 5-7" />
          </g>
        </symbol>
        <symbol id="mark-compact" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g transform="rotate(-12 17 22)">
              <circle cx="17" cy="16" r="11" fill="var(--tint)" />
              <path d="m12 18 6-8m-9 16c-12 9 15 16 20 4q0-3-4-5" />
              <path d="M7 31q9 5 19 0" />
            </g>
          </g>
        </symbol>
        <symbol id="mark-ripple" viewBox="0 0 34 42">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M6 14C7 7 14 7 17 4c5-3 12 4 11 11s3 11-1 17-13 8-17 2S4 22 6 14Z"
              fill="var(--tint)"
            />
            <path d="m12 20 8-11m-5 16 5-7" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}
export function Mirror({ name }: { name: string }) {
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
