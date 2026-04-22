import Link from "next/link";
import type { Course } from "@/types/course";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const LEVEL_COLOR: Record<string, React.CSSProperties> = {
  beginner:     { color: "rgb(0,168,56)",   border: "1px solid rgba(0,168,56,0.28)" },
  intermediate: { color: "rgb(0,102,255)",  border: "1px solid rgba(0,102,255,0.28)" },
  advanced:     { color: "rgb(82,48,219)",  border: "1px solid rgba(82,48,219,0.28)" },
};

const PALETTES = [
  { bg: "linear-gradient(135deg,#0066FF 0%,#004EC2 100%)", dark: true },
  { bg: "linear-gradient(135deg,#6541F2 0%,#2E1B7A 100%)", dark: true },
  { bg: "linear-gradient(160deg,#2E2F33 0%,#17171A 100%)", dark: true },
  { bg: "linear-gradient(135deg,#00A8B2 0%,#0066FF 100%)", dark: true },
  { bg: "linear-gradient(135deg,#FF6B42 0%,#C62828 100%)", dark: true },
  { bg: "linear-gradient(135deg,#4B5D3C 0%,#1E281A 100%)", dark: true },
  { bg: "#F4F3EE", dark: false },
  { bg: "linear-gradient(135deg,#00A838 0%,#005D20 100%)", dark: true },
  {
    bg: "radial-gradient(120% 80% at 100% 100%,#FFC800 0%,transparent 55%),linear-gradient(135deg,#0066FF 0%,#6541F2 100%)",
    dark: true,
  },
];

function hashIndex(id: string, len: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}

import type React from "react";

export function CourseCard({ course, index }: { course: Course; index?: number }) {
  const palette = PALETTES[hashIndex(course.course_id, PALETTES.length)];
  const titleColor = palette.dark ? "#fff" : "rgb(23,23,25)";
  const metaColor  = palette.dark ? "rgba(255,255,255,0.8)" : "rgba(23,23,25,0.58)";
  const srcBg      = palette.dark ? "rgba(0,0,0,0.55)" : "rgba(23,23,25,0.08)";
  const courseNo   = index !== undefined ? String(index + 1).padStart(3, "0") : "";
  const levelStyle = course.level ? LEVEL_COLOR[course.level] : {};

  return (
    <Link href={`/course/${course.course_id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
      <article
        style={{
          background: "var(--surface-background)",
          border: "1px solid var(--line-subtle)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          padding: 14,
          cursor: "pointer",
          transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-strong)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--line-default)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "none";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--line-subtle)";
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            position: "relative",
            aspectRatio: "4 / 3",
            borderRadius: "var(--radius-3xl)",
            overflow: "hidden",
            background: palette.bg,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Gradient overlay for text clarity */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            background: "linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,0.18) 100%)",
            pointerEvents: "none",
          }} />

          {/* Top row */}
          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, marginBottom: 16,
            fontSize: 11, fontWeight: 600, color: metaColor,
          }}>
            <span style={{ letterSpacing: "0.04em" }}>{courseNo}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px",
              background: srcBg,
              borderRadius: "var(--radius-pill)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              color: palette.dark ? "#fff" : "rgba(23,23,25,0.82)",
              fontSize: 11, fontWeight: 600,
            }}>
              {course.total_duration > 0 ? `${course.total_duration}분` : ""}
            </span>
          </div>

          {/* Title in thumbnail */}
          <div style={{
            position: "relative", zIndex: 1,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(18px,2.4vw,28px)",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: titleColor,
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {course.title}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 8px 4px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, fontWeight: 600, color: "var(--label-alternative)" }}>
            <span>{course.total_slides} slides</span>
            {course.total_duration > 0 && <>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--label-alternative)", opacity: 0.6, display: "inline-block" }} />
              <span>약 {course.total_duration}분</span>
            </>}
          </div>

          {/* Card title */}
          <h3 style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            color: "var(--label-strong)",
            lineHeight: 1.35,
            letterSpacing: "-0.02em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{course.title}</h3>

          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: "auto" }}>
            {course.level && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--radius-pill)",
                background: "transparent",
                ...levelStyle,
              }}>
                {LEVEL_LABEL[course.level] ?? course.level}
              </span>
            )}
            {(course.tags ?? []).slice(0, 3).map((tag) => (
              <span key={tag.slug} style={{
                fontSize: 11, fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-muted)",
                color: "var(--label-neutral)",
              }}>{tag.name}</span>
            ))}
          </div>
        </div>
      </article>
    </Link>
  );
}
