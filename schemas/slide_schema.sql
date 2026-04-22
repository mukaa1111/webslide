-- AIX 파이프라인 — Supabase DDL
-- Technical_Spec.md §3 기반
-- 실행: Supabase SQL Editor에서 순서대로 실행

-- ── 1. courses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id       TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    level           TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    author          TEXT,
    total_slides    INTEGER DEFAULT 0,
    total_duration  INTEGER DEFAULT 0,
    thumbnail_url   TEXT,
    is_published    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);

-- ── 2. tags ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);

-- ── 3. course_tags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_tags (
    course_id   TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, tag_id)
);

-- ── 4. knowledge_slides ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_slides (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_file     TEXT NOT NULL,
    slide_index     INTEGER NOT NULL,
    course_id       TEXT NOT NULL REFERENCES courses(course_id),
    title           TEXT,
    content_json    JSONB NOT NULL,
    layout          TEXT,
    tags            TEXT[] DEFAULT '{}',
    raw_md_hash     TEXT,
    degraded        BOOLEAN DEFAULT false,
    is_searchable   BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (source_file, slide_index),
    CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE INDEX IF NOT EXISTS idx_slides_course_id    ON knowledge_slides(course_id);
CREATE INDEX IF NOT EXISTS idx_slides_course_index ON knowledge_slides(course_id, slide_index);
CREATE INDEX IF NOT EXISTS idx_slides_layout       ON knowledge_slides(layout);
CREATE INDEX IF NOT EXISTS idx_slides_tags         ON knowledge_slides USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_slides_content      ON knowledge_slides USING gin(content_json);
CREATE INDEX IF NOT EXISTS idx_slides_hash         ON knowledge_slides(raw_md_hash);

-- ── 5. pipeline_log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id          TEXT NOT NULL,
    source_file     TEXT NOT NULL,
    course_id       TEXT,
    slide_count     INTEGER DEFAULT 0,
    disposition     TEXT NOT NULL,
    error_codes     TEXT[] DEFAULT '{}',
    repair_attempts INTEGER DEFAULT 0,
    raw_md_hash     TEXT,
    duration_ms     INTEGER,
    processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_run_id       ON pipeline_log(run_id);
CREATE INDEX IF NOT EXISTS idx_log_disposition  ON pipeline_log(disposition);
CREATE INDEX IF NOT EXISTS idx_log_course_id    ON pipeline_log(course_id);
CREATE INDEX IF NOT EXISTS idx_log_processed_at ON pipeline_log(processed_at DESC);

-- ── 6. pipeline_runs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id               TEXT NOT NULL UNIQUE,
    started_at           TIMESTAMPTZ NOT NULL,
    finished_at          TIMESTAMPTZ,
    duration_seconds     NUMERIC(10,2),
    total_files          INTEGER DEFAULT 0,
    processed            INTEGER DEFAULT 0,
    quarantined          INTEGER DEFAULT 0,
    dead_letter          INTEGER DEFAULT 0,
    skipped              INTEGER DEFAULT 0,
    total_slides         INTEGER DEFAULT 0,
    parse_success_rate   NUMERIC(5,2),
    status               TEXT DEFAULT 'running',
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. RLS 정책 ───────────────────────────────────────────────────────────────
ALTER TABLE knowledge_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read slides"
    ON knowledge_slides FOR SELECT
    USING (is_searchable = true);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read courses"
    ON courses FOR SELECT
    USING (is_published = true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tags" ON tags FOR SELECT USING (true);

-- ── 8. 집계 함수 ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_course_stats(p_course_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE courses
    SET
        total_slides = (SELECT COUNT(*) FROM knowledge_slides WHERE course_id = p_course_id),
        updated_at = NOW()
    WHERE course_id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_tag_counts()
RETURNS void AS $$
BEGIN
    UPDATE tags t
    SET usage_count = (SELECT COUNT(*) FROM course_tags ct WHERE ct.tag_id = t.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
