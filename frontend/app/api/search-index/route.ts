import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("knowledge_slides")
    .select("id, slide_index, course_id, title, tags")
    .eq("is_searchable", true)
    .not("title", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const index = (data || []).map((row: any) => ({
    id: row.id,
    courseId: row.course_id,
    slideIndex: row.slide_index,
    title: row.title,
    tags: row.tags || [],
  }));

  return NextResponse.json({
    index,
    generated_at: new Date().toISOString(),
  });
}
