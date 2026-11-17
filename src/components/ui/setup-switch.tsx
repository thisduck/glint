import React from "react";

export function SetupSwitch({ label, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="setup-switch"
    >
      <span aria-hidden="true" />
    </button>
  );
}
