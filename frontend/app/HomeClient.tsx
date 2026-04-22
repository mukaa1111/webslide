"use client";

import { useState } from "react";
import type { Course } from "@/types/course";
import { CourseCard } from "@/components/home/CourseCard";
import { SearchBar } from "@/components/home/SearchBar";

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const LEVEL_LABEL = { beginner: "입문", intermediate: "중급", advanced: "고급" } as const;

export function HomeClient({ courses }: { courses: Course[] }) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const filtered = courses.filter((c) => {
    const matchLevel = !levelFilter || c.level === levelFilter;
    const matchQuery =
      !query ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      (c.tags ?? []).some((t) => t.name.toLowerCase().includes(query.toLowerCase()));
    return matchLevel && matchQuery;
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top bar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "color-mix(in oklab, var(--surface-background) 82%, transparent)",
        backdropFilter: "saturate(140%) blur(16px)",
        WebkitBackdropFilter: "saturate(140%) blur(16px)",
        borderBottom: "1px solid var(--line-subtle)",
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          padding: "14px 40px",
          display: "flex", alignItems: "center", gap: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--label-strong)" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "var(--c-neutral-950)", color: "var(--c-neutral-0)",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14,
            }}>A</div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.025em" }}>
              AIX<span style={{ color: "var(--primary-normal)" }}>.</span>Slides
            </span>
          </div>

          <SearchBar value={query} onChange={setQuery} />
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 40px 160px" }}>
        {/* Greeting */}
        <section style={{ marginBottom: 48 }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(28px,4vw,44px)",
            letterSpacing: "-0.03em",
            color: "var(--label-strong)",
            lineHeight: 1.22, marginBottom: 12,
          }}>
            지식을 <span style={{ color: "var(--primary-normal)" }}>슬라이드</span>로<br />빠르게 소비하세요
          </h1>
          <p style={{ color: "var(--label-alternative)", fontSize: 16, lineHeight: 1.6 }}>
            영상 1시간 → 슬라이드 3~5분. {courses.length}개 코스 · {courses.reduce((a, c) => a + c.total_slides, 0)}개 슬라이드
          </p>
        </section>

        {/* Level filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
          <button
            onClick={() => setLevelFilter(null)}
            style={{
              padding: "6px 16px", borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line-default)",
              background: !levelFilter ? "var(--c-neutral-950)" : "transparent",
              color: !levelFilter ? "var(--c-neutral-0)" : "var(--label-alternative)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >전체</button>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv === levelFilter ? null : lv)}
              style={{
                padding: "6px 16px", borderRadius: "var(--radius-pill)",
                border: "1px solid var(--line-default)",
                background: levelFilter === lv ? "var(--c-neutral-950)" : "transparent",
                color: levelFilter === lv ? "var(--c-neutral-0)" : "var(--label-alternative)",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >{LEVEL_LABEL[lv]}</button>
          ))}
        </div>

        {/* Course grid */}
        <section>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 24,
          }}>
            {filtered.map((course, i) => (
              <CourseCard key={course.course_id} course={course} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: "80px 0", textAlign: "center", color: "var(--label-assistive)" }}>
              <p style={{ fontSize: 16 }}>검색 결과가 없습니다.</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>다른 키워드로 검색해 보세요.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
