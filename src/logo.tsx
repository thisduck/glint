import React from "react";
export function Logo() {
  return (
    <svg
      className="h-9 w-7 shrink-0 text-ink"
      viewBox="0 0 34 42"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g transform="rotate(24 17 21)">
        <path d="M17 28v9" strokeWidth="3.2" />
        <ellipse cx="17" cy="16" rx="9.6" ry="12.2" fill="var(--tint)" />
        <path d="m13 16 4-6" />
      </g>
    </svg>
  );
}
