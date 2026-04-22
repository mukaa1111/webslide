"use client";

import { useMemo, useState } from "react";
import { buildSearchIndex } from "@/lib/search/buildIndex";
import type { SearchIndexItem } from "@/types/slide";

export function useFuzzySearch(items: SearchIndexItem[]) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(() => buildSearchIndex(items), [items]);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return items;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, items]);

  return { query, setQuery, results };
}
