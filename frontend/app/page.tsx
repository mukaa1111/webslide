import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types/course";
import { HomeClient } from "./HomeClient";

async function getCourses(): Promise<Course[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(`
      course_id, title, description, level,
      total_slides, total_duration, thumbnail_url, author,
      course_tags ( tags ( name, slug ) )
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((c: any) => ({
    ...c,
    tags: (c.course_tags || []).flatMap((ct: any) =>
      ct.tags ? [{ name: ct.tags.name, slug: ct.tags.slug }] : []
    ),
    course_tags: undefined,
  }));
}

export default async function HomePage() {
  const courses = await getCourses();

  return (
    <Suspense>
      <HomeClient courses={courses} />
    </Suspense>
  );
}
