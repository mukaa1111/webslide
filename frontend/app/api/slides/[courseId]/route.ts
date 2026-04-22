import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const supabase = createClient();
  const { courseId } = params;

  const [courseRes, slidesRes] = await Promise.all([
    supabase
      .from("courses")
      .select("course_id, title, level, total_slides, total_duration, author")
      .eq("course_id", courseId)
      .single(),
    supabase
      .from("knowledge_slides")
      .select("id, slide_index, title, layout, content_json, tags")
      .eq("course_id", courseId)
      .eq("is_searchable", true)
      .order("slide_index", { ascending: true }),
  ]);

  if (courseRes.error || !courseRes.data) {
    return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    course: courseRes.data,
    slides: slidesRes.data || [],
  });
}
