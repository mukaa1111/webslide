import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("name, slug, usage_count")
    .gt("usage_count", 0)
    .order("usage_count", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tags: data || [] });
}
