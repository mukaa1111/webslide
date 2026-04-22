"use client";

interface Props {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

function ArrowBtn({ onClick, disabled, dir }: { onClick: () => void; disabled: boolean; dir: "left" | "right" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "이전 슬라이드" : "다음 슬라이드"}
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--radius-pill)",
        background: disabled ? "transparent" : "var(--surface-subtle)",
        border: "1px solid var(--line-default)",
        color: disabled ? "var(--label-assistive)" : "var(--label-neutral)",
        display: "inline-grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .12s, color .12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-subtle)";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        {dir === "left"
          ? <path d="M15 18l-6-6 6-6" />
          : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

export function SlideControls({ onPrev, onNext, canPrev, canNext }: Props) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <ArrowBtn onClick={onPrev} disabled={!canPrev} dir="left" />
      <ArrowBtn onClick={onNext} disabled={!canNext} dir="right" />
    </div>
  );
}
