export interface ContentBlock {
  type: "paragraph" | "heading" | "code" | "list" | "blockquote" | "table" | "image" | "divider";
  text?: string;
  depth?: number;
  lang?: string;
  ordered?: boolean;
  items?: Array<{ text: string; children?: Array<{ text: string }> }>;
  headers?: string[];
  rows?: string[][];
  url?: string;
  alt?: string;
  title?: string;
}

export interface SlideData {
  index: number;
  title: string | null;
  layout: "default" | "code-only" | "bullet-list" | "image-focus" | "title-only" | "diagram" | "statement" | "compare";
  blocks: ContentBlock[];
  notes: string | null;
}

export interface SlideMeta {
  courseId: string;
  title?: string;
  order?: number;
  level?: "beginner" | "intermediate" | "advanced";
  duration?: number;
  tags?: string[];
  author?: string;
}

export interface SlideRow {
  id: string;
  slide_index: number;
  title: string | null;
  layout: SlideData["layout"] | string;
  content_json: SlideData & { meta?: SlideMeta };
  tags: string[];
}

export interface SearchIndexItem {
  id: string;
  courseId: string;
  slideIndex: number;
  title: string;
  tags: string[];
}
