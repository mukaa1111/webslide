import Fuse from "fuse.js";
import type { SearchIndexItem } from "@/types/slide";

const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "tags", weight: 0.3 },
    { name: "courseId", weight: 0.2 },
  ],
  threshold: 0.4,
  includeMatches: true,
  minMatchCharLength: 2,
};

export function buildSearchIndex(items: SearchIndexItem[]) {
  return new Fuse(items, FUSE_OPTIONS);
}
