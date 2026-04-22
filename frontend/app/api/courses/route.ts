import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(`
      course_id,
      title,
      description,
      level,
      total_slides,
      total_duration,
      thumbnail_url,
      author,
      course_tags (
        tags ( name, slug )
      )
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const courses = (data || []).map((c: any) => ({
    ...c,
    tags: (c.course_tags || []).flatMap((ct: any) =>
      ct.tags ? [{ name: ct.tags.name, slug: ct.tags.slug }] : []
    ),
    course_tags: undefined,
  }));

  return NextResponse.json({ data: courses, count: courses.length });
}
