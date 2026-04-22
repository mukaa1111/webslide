"use client";

interface Props {
  current: number;
  total: number;
  onSeek?: (index: number) => void;
}

export function ProgressBar({ current, total, onSeek }: Props) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
      {/* Bar */}
      <div
        onClick={(e) => {
          if (!onSeek) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          onSeek(Math.floor(ratio * total));
        }}
        style={{
          flex: 1,
          height: 4,
          background: "var(--line-default)",
          borderRadius: "var(--radius-pill)",
          cursor: onSeek ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: "var(--primary-normal)",
            borderRadius: "var(--radius-pill)",
            transition: "width .2s ease",
          }}
        />
      </div>

      {/* Counter */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontVariantNumeric: "tabular-nums",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--label-alternative)",
          whiteSpace: "nowrap",
          minWidth: 52,
          textAlign: "right",
        }}
      >
        {current + 1} / {total}
      </span>
    </div>
  );
}
