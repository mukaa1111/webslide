import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SlideViewer } from "@/components/slides/SlideViewer";
import type { SlideRow } from "@/types/slide";
import type { Course } from "@/types/course";

interface Props {
  params: { courseId: string };
  searchParams: { slide?: string };
}

async function getData(courseId: string): Promise<{ course: Course; slides: SlideRow[] } | null> {
  const supabase = createClient();

  const [courseRes, slidesRes] = await Promise.all([
    supabase
      .from("courses")
      .select("course_id, title, description, level, total_slides, total_duration, author")
      .eq("course_id", courseId)
      .single(),
    supabase
      .from("knowledge_slides")
      .select("id, slide_index, title, layout, content_json, tags")
      .eq("course_id", courseId)
      .eq("is_searchable", true)
      .order("slide_index", { ascending: true }),
  ]);

  if (courseRes.error || !courseRes.data) return null;

  return {
    course: courseRes.data as Course,
    slides: (slidesRes.data || []) as SlideRow[],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getData(params.courseId);
  if (!data) return { title: "코스를 찾을 수 없습니다" };
  return {
    title: data.course.title,
    description: `${data.course.total_slides}개 슬라이드 | ${data.course.level ?? ""}`,
  };
}

export default async function CoursePage({ params, searchParams }: Props) {
  const data = await getData(params.courseId);
  if (!data) notFound();

  const initialSlide = Math.min(Number(searchParams.slide) || 0, data.slides.length - 1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-background)" }}>
      <SlideViewer course={data.course} slides={data.slides} initialSlide={initialSlide} />
    </div>
  );
}
