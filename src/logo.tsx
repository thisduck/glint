import React from "react";
export function Logo() {
  return (
    <svg
      className="size-8 shrink-0 text-ink"
      viewBox="0 0 40 40"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <ellipse cx="20" cy="15" rx="9" ry="11" fill="var(--tint)" />
      <path d="M7 15a13 14 0 0 0 26 0M20 29v6m-7 1h14m-11-20 4-6" />
    </svg>
  );
}
