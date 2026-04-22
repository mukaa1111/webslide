"use client";

import { useSlideNavigation } from "@/hooks/useSlideNavigation";
import { SlideRenderer } from "./SlideRenderer";
import { ProgressBar } from "./ProgressBar";
import { SlideControls } from "./SlideControls";
import { NotesPanel } from "./NotesPanel";
import type { SlideRow } from "@/types/slide";
import type { Course } from "@/types/course";

interface Props {
  course: Course;
  slides: SlideRow[];
  initialSlide?: number;
}

export function SlideViewer({ course, slides, initialSlide = 0 }: Props) {
  const total = slides.length;
  const { current, goTo, goNext, goPrev } = useSlideNavigation(course.course_id, total);

  const currentSlide = slides[current]?.content_json;

  if (!currentSlide) {
    return (
      <div style={{ padding: 40, color: "var(--label-alternative)", textAlign: "center" }}>
        슬라이드를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "color-mix(in oklab, var(--surface-background) 84%, transparent)",
        backdropFilter: "saturate(140%) blur(16px)",
        WebkitBackdropFilter: "saturate(140%) blur(16px)",
        borderBottom: "1px solid var(--line-subtle)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px,1fr) minmax(0,2fr) minmax(140px,1fr)",
          alignItems: "center",
          gap: 20,
          padding: "12px 40px",
          maxWidth: 1280,
          margin: "0 auto",
        }}>
          <a href="/" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "var(--label-neutral)",
            fontWeight: 600,
            fontSize: 14,
            padding: "7px 12px 7px 8px",
            borderRadius: "var(--radius-pill)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            목록
          </a>

          <ProgressBar current={current} total={total} onSeek={goTo} />

          <div style={{ justifySelf: "end" }}>
            <SlideControls
              onPrev={goPrev}
              onNext={goNext}
              canPrev={current > 0}
              canNext={current < total - 1}
            />
          </div>
        </div>
      </header>

      {/* Slide content */}
      <main
        style={{
          flex: 1,
          maxWidth: 900,
          width: "100%",
          margin: "0 auto",
          padding: "0 20px",
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        <div style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--line-subtle)",
          borderRadius: "var(--radius-3xl)",
          margin: "32px 0",
          boxShadow: "var(--shadow-normal)",
          overflow: "hidden",
        }}>
          <SlideRenderer slide={currentSlide} />
          <div style={{ padding: "0 48px 32px" }}>
            <NotesPanel notes={currentSlide.notes} />
          </div>
        </div>
      </main>
    </div>
  );
}
