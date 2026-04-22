"use client";

import { useId } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "코스·슬라이드 검색..." }: Props) {
  const id = useId();
  return (
    <div style={{ position: "relative", maxWidth: 520, flex: 1 }}>
      {/* Search icon */}
      <svg
        style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "var(--label-alternative)", pointerEvents: "none" }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>

      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: 42,
          padding: "0 40px 0 42px",
          background: "var(--surface-subtle)",
          border: "1px solid transparent",
          borderRadius: "var(--radius-pill)",
          color: "var(--label-strong)",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          outline: "none",
          transition: "background .12s, border-color .12s, box-shadow .12s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = "var(--surface-background)";
          e.currentTarget.style.borderColor = "var(--primary-normal)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,102,255,.18)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = "var(--surface-subtle)";
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {value && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--label-alternative)" }}>
          ⌘K
        </span>
      )}
    </div>
  );
}
