export interface Course {
  course_id: string;
  title: string;
  description?: string | null;
  level?: "beginner" | "intermediate" | "advanced" | null;
  author?: string | null;
  total_slides: number;
  total_duration: number;
  thumbnail_url?: string | null;
  tags?: Array<{ name: string; slug: string }>;
}

export interface Tag {
  name: string;
  slug: string;
  usage_count: number;
}
