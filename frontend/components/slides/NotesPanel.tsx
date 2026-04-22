"use client";

import { useState } from "react";

interface Props {
  notes: string | null;
}

export function NotesPanel({ notes }: Props) {
  const [open, setOpen] = useState(false);

  if (!notes) return null;

  return (
    <div style={{ borderTop: "1px solid var(--line-subtle)", marginTop: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "12px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--label-alternative)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        발표자 노트
      </button>

      {open && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--surface-subtle)",
            borderRadius: "var(--radius-lg)",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--label-neutral)",
            whiteSpace: "pre-wrap",
            marginBottom: 16,
          }}
        >
          {notes}
        </div>
      )}
    </div>
  );
}
