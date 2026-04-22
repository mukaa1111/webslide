# Supabase 교육 콘텐츠 데이터베이스 기술 레퍼런스

## VOD/영상 기반 교육 플랫폼을 위한 종합 가이드

---

## 목차

1. [시스템 개요 및 아키텍처](#1-시스템-개요-및-아키텍처)
2. [교육 콘텐츠 DB 스키마 설계](#2-교육-콘텐츠-db-스키마-설계)
3. [Supabase 테이블 생성 SQL](#3-supabase-테이블-생성-sql)
4. [Row Level Security (RLS) 정책](#4-row-level-security-rls-정책)
5. [전문 검색 (Full-Text Search)](#5-전문-검색-full-text-search)
6. [실시간 구독 (Real-time Subscriptions)](#6-실시간-구독-real-time-subscriptions)
7. [스토리지 미디어 에셋 관리](#7-스토리지-미디어-에셋-관리)
8. [Edge Functions 콘텐츠 처리 파이프라인](#8-edge-functions-콘텐츠-처리-파이프라인)
9. [Next.js 연동 패턴](#9-nextjs-연동-패턴)
10. [학습 진행률 추적 구현](#10-학습-진행률-추적-구현)
11. [성능 최적화 및 인덱싱](#11-성능-최적화-및-인덱싱)

---

## 1. 시스템 개요 및 아키텍처

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App (App Router)                  │
│  ┌─────────────────┐          ┌─────────────────────────┐   │
│  │  Server Components│        │   Client Components      │   │
│  │  (SSR/SSG/ISR)   │        │   (Realtime / UI)        │   │
│  └────────┬─────────┘         └──────────┬──────────────┘   │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│                        Supabase Platform                       │
│                                                               │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │  Auth      │  │  Storage             │  │
│  │  (Database)  │  │  (JWT/RLS) │  │  (Thumbnails/Audio)  │  │
│  └──────────────┘  └────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Realtime    │  │  Edge Func │  │  Full-Text Search    │  │
│  │  (WebSocket) │  │  (Deno)    │  │  (pg_trgm / tsvector)│  │
│  └──────────────┘  └────────────┘  └──────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│   외부 파이프라인               │
│   VOD → 슬라이드 추출           │
│   음성 → 텍스트 변환 (STT)      │
│   AI 요약 생성                  │
└───────────────────────────────┘
```

---

## 2. 교육 콘텐츠 DB 스키마 설계

### ERD (텍스트)

```
[profiles]                         [organizations]
  id (FK→auth.users)  ─────┐         id
  full_name                │         name
  avatar_url               │         slug
  role                     │         plan
  organization_id  ────────┼────────►  created_at
  created_at               │
                           │
[courses]◄─────────────────┘
  id
  organization_id ────────►[organizations]
  author_id ──────────────►[profiles]
  title
  description
  slug (unique)
  thumbnail_url
  status (draft|published|archived)
  difficulty (beginner|intermediate|advanced)
  tags[]
  metadata (jsonb)
  created_at
  updated_at
       │
       │ 1:N
       ▼
[chapters]
  id
  course_id ──────────────►[courses]
  title
  description
  order_index
  is_free_preview
  created_at
       │
       │ 1:N
       ▼
[slides]
  id
  chapter_id ─────────────►[chapters]
  title
  content_text             (전문 검색용 원문)
  content_html
  slide_type (text|image|quiz|interactive)
  order_index
  thumbnail_url
  audio_summary_url
  duration_seconds
  metadata (jsonb)         (퀴즈 데이터, 외부 링크 등)
  fts_vector (tsvector)    (자동 생성 전문 검색 벡터)
  created_at
  updated_at

[enrollments]              (수강 등록)
  id
  user_id ────────────────►[profiles]
  course_id ──────────────►[courses]
  enrolled_at
  expires_at
  status (active|expired|refunded)
  UNIQUE(user_id, course_id)

[user_progress]            (학습 진행률)
  id
  user_id ────────────────►[profiles]
  slide_id ───────────────►[slides]
  course_id ──────────────►[courses]
  chapter_id ─────────────►[chapters]
  status (not_started|in_progress|completed)
  time_spent_seconds
  last_position_seconds    (영상 재생 위치)
  completed_at
  updated_at
  UNIQUE(user_id, slide_id)

[quiz_attempts]            (퀴즈 시도)
  id
  user_id ────────────────►[profiles]
  slide_id ───────────────►[slides]
  answers (jsonb)
  score
  passed
  attempted_at

[comments]                 (협업/질문 댓글)
  id
  user_id ────────────────►[profiles]
  slide_id ───────────────►[slides]
  parent_id ──────────────►[comments]  (대댓글)
  content
  is_resolved
  created_at
  updated_at

[bookmarks]                (북마크)
  id
  user_id ────────────────►[profiles]
  slide_id ───────────────►[slides]
  note
  created_at
  UNIQUE(user_id, slide_id)

[media_assets]             (미디어 에셋 메타데이터)
  id
  slide_id ───────────────►[slides]
  asset_type (thumbnail|audio|video_clip|pdf)
  storage_path
  file_size_bytes
  mime_type
  processing_status (pending|processing|ready|failed)
  created_at
```

---

## 3. Supabase 테이블 생성 SQL

### 3.1 기반 설정 및 Extensions

```sql
-- 필요한 PostgreSQL Extension 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- 유사도 검색
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- 발음 부호 무시 검색
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 전문 검색용 한국어 설정 (기본 simple 설정 사용, 필요시 custom 설정)
-- 참고: 한국어 전용 파서가 없으므로 simple + pg_trgm 조합 사용
```

### 3.2 Organizations 및 Profiles

```sql
-- 조직/기관 테이블
CREATE TABLE public.organizations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    logo_url    TEXT,
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 사용자 프로필 (auth.users 확장)
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    full_name       TEXT,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'learner'
                        CHECK (role IN ('super_admin', 'org_admin', 'instructor', 'learner')),
    bio             TEXT,
    preferences     JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 새 사용자 가입 시 자동으로 프로필 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### 3.3 Courses 및 Chapters

```sql
-- 강좌 테이블
CREATE TABLE public.courses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title           TEXT NOT NULL,
    description     TEXT,
    slug            TEXT NOT NULL UNIQUE,
    thumbnail_url   TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
    difficulty      TEXT NOT NULL DEFAULT 'beginner'
                        CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- 통계 캐시 (실시간 COUNT 쿼리 방지)
    total_slides    INTEGER NOT NULL DEFAULT 0,
    total_chapters  INTEGER NOT NULL DEFAULT 0,
    total_duration  INTEGER NOT NULL DEFAULT 0,  -- 초 단위
    enrolled_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 챕터 테이블
CREATE TABLE public.chapters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    order_index     INTEGER NOT NULL DEFAULT 0,
    is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, order_index)
);
```

### 3.4 Slides (핵심 지식 에셋)

```sql
-- 슬라이드 테이블 (VOD에서 변환된 개별 지식 단위)
CREATE TABLE public.slides (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id            UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    content_text          TEXT,          -- 전문 검색용 원문 텍스트
    content_html          TEXT,          -- 렌더링용 HTML
    slide_type            TEXT NOT NULL DEFAULT 'text'
                              CHECK (slide_type IN ('text', 'image', 'quiz', 'interactive', 'video_clip')),
    order_index           INTEGER NOT NULL DEFAULT 0,
    thumbnail_url         TEXT,
    audio_summary_url     TEXT,
    duration_seconds      INTEGER,
    metadata              JSONB NOT NULL DEFAULT '{}',
    -- 전문 검색 벡터 (자동 업데이트)
    fts_vector            TSVECTOR,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 전문 검색 벡터 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.slides_fts_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.fts_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content_text, '')), 'B');
    RETURN NEW;
END;
$$;

CREATE TRIGGER slides_fts_trigger
    BEFORE INSERT OR UPDATE OF title, content_text
    ON public.slides
    FOR EACH ROW
    EXECUTE FUNCTION public.slides_fts_update();
```

### 3.5 수강 등록 및 진행률

```sql
-- 수강 등록 테이블
CREATE TABLE public.enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'refunded')),
    UNIQUE (user_id, course_id)
);

-- 수강 등록 시 courses.enrolled_count 자동 업데이트
CREATE OR REPLACE FUNCTION public.update_enrolled_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.courses
        SET enrolled_count = enrolled_count + 1
        WHERE id = NEW.course_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.courses
        SET enrolled_count = enrolled_count - 1
        WHERE id = OLD.course_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_enrollment_change
    AFTER INSERT OR DELETE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_enrolled_count();

-- 학습 진행률 테이블
CREATE TABLE public.user_progress (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slide_id              UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
    course_id             UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    chapter_id            UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    status                TEXT NOT NULL DEFAULT 'not_started'
                              CHECK (status IN ('not_started', 'in_progress', 'completed')),
    time_spent_seconds    INTEGER NOT NULL DEFAULT 0,
    last_position_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at          TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, slide_id)
);

-- 퀴즈 시도 테이블
CREATE TABLE public.quiz_attempts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slide_id     UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
    answers      JSONB NOT NULL DEFAULT '{}',
    score        NUMERIC(5,2),
    passed       BOOLEAN,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 댓글/질문 테이블
CREATE TABLE public.comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slide_id    UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 북마크 테이블
CREATE TABLE public.bookmarks (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slide_id   UUID NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, slide_id)
);

-- 미디어 에셋 메타데이터
CREATE TABLE public.media_assets (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slide_id           UUID REFERENCES public.slides(id) ON DELETE CASCADE,
    course_id          UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    asset_type         TEXT NOT NULL
                           CHECK (asset_type IN ('thumbnail', 'audio', 'video_clip', 'pdf', 'image')),
    storage_path       TEXT NOT NULL,
    file_size_bytes    BIGINT,
    mime_type          TEXT,
    processing_status  TEXT NOT NULL DEFAULT 'pending'
                           CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
    error_message      TEXT,
    metadata           JSONB NOT NULL DEFAULT '{}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Row Level Security (RLS) 정책

### 4.1 RLS 활성화

```sql
-- 모든 테이블에 RLS 활성화
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets    ENABLE ROW LEVEL SECURITY;
```

### 4.2 헬퍼 함수

```sql
-- 현재 사용자의 역할 반환 (성능을 위해 캐시)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 현재 사용자의 조직 ID 반환
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 사용자가 특정 강좌에 수강 등록되어 있는지 확인
CREATE OR REPLACE FUNCTION public.is_enrolled(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE user_id = auth.uid()
          AND course_id = p_course_id
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
    );
$$;

-- 사용자가 강좌의 강사인지 확인
CREATE OR REPLACE FUNCTION public.is_course_instructor(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = p_course_id
          AND author_id = auth.uid()
    );
$$;
```

### 4.3 Profiles RLS 정책

```sql
-- 자신의 프로필 조회
CREATE POLICY "profiles: 본인 조회"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- 같은 조직 내 프로필 조회
CREATE POLICY "profiles: 같은 조직 조회"
    ON public.profiles FOR SELECT
    USING (
        organization_id IS NOT NULL
        AND organization_id = public.get_my_org_id()
    );

-- 강좌 강사 프로필은 수강생도 조회 가능
CREATE POLICY "profiles: 강사 프로필 공개"
    ON public.profiles FOR SELECT
    USING (
        role IN ('instructor', 'org_admin')
    );

-- 본인 프로필만 수정 가능
CREATE POLICY "profiles: 본인 수정"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
```

### 4.4 Courses RLS 정책

```sql
-- 공개된 강좌는 누구나 조회 가능
CREATE POLICY "courses: 공개 강좌 조회"
    ON public.courses FOR SELECT
    USING (status = 'published');

-- 강사는 자신의 모든 강좌 조회 (초안 포함)
CREATE POLICY "courses: 강사 본인 강좌 조회"
    ON public.courses FOR SELECT
    USING (author_id = auth.uid());

-- 조직 관리자는 조직 내 모든 강좌 조회
CREATE POLICY "courses: 조직 관리자 조회"
    ON public.courses FOR SELECT
    USING (
        public.get_my_role() IN ('org_admin', 'super_admin')
        AND organization_id = public.get_my_org_id()
    );

-- 강사/관리자만 강좌 생성 가능
CREATE POLICY "courses: 강사 강좌 생성"
    ON public.courses FOR INSERT
    WITH CHECK (
        public.get_my_role() IN ('instructor', 'org_admin', 'super_admin')
        AND author_id = auth.uid()
    );

-- 강사는 자신의 강좌만 수정 가능
CREATE POLICY "courses: 강사 본인 강좌 수정"
    ON public.courses FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- 조직 관리자는 조직 내 강좌 수정 가능
CREATE POLICY "courses: 조직 관리자 수정"
    ON public.courses FOR UPDATE
    USING (
        public.get_my_role() IN ('org_admin', 'super_admin')
        AND organization_id = public.get_my_org_id()
    );
```

### 4.5 Slides RLS 정책

```sql
-- 공개 강좌의 무료 챕터 슬라이드는 누구나 조회 가능
CREATE POLICY "slides: 무료 미리보기 슬라이드 조회"
    ON public.slides FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.chapters ch
            JOIN public.courses c ON c.id = ch.course_id
            WHERE ch.id = slides.chapter_id
              AND ch.is_free_preview = TRUE
              AND c.status = 'published'
        )
    );

-- 수강 등록된 사용자는 해당 강좌의 모든 슬라이드 조회 가능
CREATE POLICY "slides: 수강생 슬라이드 조회"
    ON public.slides FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.chapters ch
            WHERE ch.id = slides.chapter_id
              AND public.is_enrolled(ch.course_id)
        )
    );

-- 강사는 자신의 강좌 슬라이드 전체 접근
CREATE POLICY "slides: 강사 슬라이드 전체 접근"
    ON public.slides FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.chapters ch
            WHERE ch.id = slides.chapter_id
              AND public.is_course_instructor(ch.course_id)
        )
    );
```

### 4.6 User Progress RLS 정책

```sql
-- 본인의 진행률만 조회/수정 가능
CREATE POLICY "user_progress: 본인 진행률 조회"
    ON public.user_progress FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_progress: 본인 진행률 삽입"
    ON public.user_progress FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_progress: 본인 진행률 수정"
    ON public.user_progress FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 강사는 자신의 강좌 수강생 진행률 조회 가능
CREATE POLICY "user_progress: 강사 수강생 진행률 조회"
    ON public.user_progress FOR SELECT
    USING (
        public.is_course_instructor(course_id)
    );
```

### 4.7 Comments RLS 정책

```sql
-- 수강생과 강사는 댓글 조회 가능
CREATE POLICY "comments: 수강생/강사 댓글 조회"
    ON public.comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.slides s
            JOIN public.chapters ch ON ch.id = s.chapter_id
            WHERE s.id = comments.slide_id
              AND (
                  public.is_enrolled(ch.course_id)
                  OR public.is_course_instructor(ch.course_id)
              )
        )
    );

-- 수강생은 댓글 작성 가능
CREATE POLICY "comments: 수강생 댓글 작성"
    ON public.comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.slides s
            JOIN public.chapters ch ON ch.id = s.chapter_id
            WHERE s.id = slide_id
              AND public.is_enrolled(ch.course_id)
        )
    );

-- 본인 댓글만 수정/삭제 가능
CREATE POLICY "comments: 본인 댓글 수정"
    ON public.comments FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments: 본인 댓글 삭제"
    ON public.comments FOR DELETE
    USING (user_id = auth.uid());

-- 강사는 자신의 강좌 댓글 resolved 처리 가능
CREATE POLICY "comments: 강사 댓글 관리"
    ON public.comments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.slides s
            JOIN public.chapters ch ON ch.id = s.chapter_id
            WHERE s.id = slide_id
              AND public.is_course_instructor(ch.course_id)
        )
    );
```

---

## 5. 전문 검색 (Full-Text Search)

### 5.1 인덱스 생성

```sql
-- GIN 인덱스 생성 (전문 검색 성능 최적화)
CREATE INDEX idx_slides_fts ON public.slides USING GIN (fts_vector);

-- pg_trgm 인덱스 (유사도 검색, 오타 허용)
CREATE INDEX idx_slides_title_trgm  ON public.slides USING GIN (title gin_trgm_ops);
CREATE INDEX idx_courses_title_trgm ON public.courses USING GIN (title gin_trgm_ops);

-- 태그 배열 인덱스
CREATE INDEX idx_courses_tags ON public.courses USING GIN (tags);
```

### 5.2 통합 검색 함수

```sql
-- 슬라이드 전문 검색 함수
CREATE OR REPLACE FUNCTION public.search_slides(
    p_query         TEXT,
    p_course_id     UUID DEFAULT NULL,
    p_limit         INTEGER DEFAULT 20,
    p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
    slide_id        UUID,
    slide_title     TEXT,
    chapter_title   TEXT,
    course_title    TEXT,
    course_id       UUID,
    snippet         TEXT,
    rank            REAL,
    match_type      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tsquery TSQUERY;
BEGIN
    -- 검색어를 TSQuery로 변환 (OR 조합)
    v_tsquery := websearch_to_tsquery('simple', p_query);

    RETURN QUERY
    WITH ranked_slides AS (
        -- 전문 검색
        SELECT
            s.id                                           AS slide_id,
            s.title                                        AS slide_title,
            ch.title                                       AS chapter_title,
            c.title                                        AS course_title,
            c.id                                           AS course_id,
            ts_headline(
                'simple',
                COALESCE(s.content_text, ''),
                v_tsquery,
                'MaxWords=50, MinWords=20, ShortWord=3, HighlightAll=FALSE'
            )                                              AS snippet,
            ts_rank_cd(s.fts_vector, v_tsquery)           AS rank,
            'fulltext'::TEXT                               AS match_type
        FROM public.slides s
        JOIN public.chapters ch ON ch.id = s.chapter_id
        JOIN public.courses c ON c.id = ch.course_id
        WHERE
            s.fts_vector @@ v_tsquery
            AND c.status = 'published'
            AND (p_course_id IS NULL OR c.id = p_course_id)
            AND (
                public.is_enrolled(c.id)
                OR ch.is_free_preview = TRUE
                OR public.is_course_instructor(c.id)
            )

        UNION ALL

        -- 유사도 검색 (전문 검색에서 미결과 시 보완)
        SELECT
            s.id,
            s.title,
            ch.title,
            c.title,
            c.id,
            LEFT(COALESCE(s.content_text, ''), 200)        AS snippet,
            similarity(s.title, p_query)                   AS rank,
            'similarity'::TEXT                             AS match_type
        FROM public.slides s
        JOIN public.chapters ch ON ch.id = s.chapter_id
        JOIN public.courses c ON c.id = ch.course_id
        WHERE
            similarity(s.title, p_query) > 0.3
            AND NOT (s.fts_vector @@ v_tsquery)  -- 중복 제거
            AND c.status = 'published'
            AND (p_course_id IS NULL OR c.id = p_course_id)
            AND (
                public.is_enrolled(c.id)
                OR ch.is_free_preview = TRUE
            )
    )
    SELECT DISTINCT ON (slide_id)
        slide_id, slide_title, chapter_title, course_title,
        course_id, snippet, rank, match_type
    FROM ranked_slides
    ORDER BY slide_id, rank DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
```

### 5.3 검색 API 호출 예시 (supabase-js)

```typescript
// lib/search.ts
import { createClient } from '@/lib/supabase/client'

export interface SearchResult {
  slide_id: string
  slide_title: string
  chapter_title: string
  course_title: string
  course_id: string
  snippet: string
  rank: number
  match_type: 'fulltext' | 'similarity'
}

export async function searchSlides(
  query: string,
  courseId?: string,
  limit = 20
): Promise<SearchResult[]> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('search_slides', {
    p_query:     query,
    p_course_id: courseId ?? null,
    p_limit:     limit,
    p_offset:    0,
  })

  if (error) throw error
  return data as SearchResult[]
}
```

---

## 6. 실시간 구독 (Real-time Subscriptions)

### 6.1 Supabase Realtime 설정

```sql
-- Realtime 활성화할 테이블 지정
-- Supabase 대시보드 또는 아래 쿼리로 설정

ALTER PUBLICATION supabase_realtime
    ADD TABLE public.comments;

ALTER PUBLICATION supabase_realtime
    ADD TABLE public.user_progress;

ALTER PUBLICATION supabase_realtime
    ADD TABLE public.quiz_attempts;
```

### 6.2 실시간 댓글 구독 (React 훅)

```typescript
// hooks/useSlideComments.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface Comment {
  id: string
  user_id: string
  slide_id: string
  parent_id: string | null
  content: string
  is_resolved: boolean
  created_at: string
  profiles: {
    full_name: string
    avatar_url: string | null
  }
}

export function useSlideComments(slideId: string) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 초기 댓글 로드
  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (
          full_name,
          avatar_url
        )
      `)
      .eq('slide_id', slideId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setComments(data as Comment[])
    }
    setIsLoading(false)
  }, [slideId, supabase])

  useEffect(() => {
    loadComments()

    // 실시간 구독 설정
    const channel = supabase
      .channel(`comments:${slideId}`)
      .on<Comment>(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'comments',
          filter: `slide_id=eq.${slideId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Comment>) => {
          // 새 댓글 작성자 프로필 조회
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single()

          const newComment = {
            ...payload.new,
            profiles: profile ?? { full_name: '알 수 없음', avatar_url: null },
          }
          setComments(prev => [...prev, newComment])
        }
      )
      .on<Comment>(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'comments',
          filter: `slide_id=eq.${slideId}`,
        },
        (payload: RealtimePostgresChangesPayload<Comment>) => {
          setComments(prev =>
            prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
          )
        }
      )
      .on<Comment>(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'comments',
          filter: `slide_id=eq.${slideId}`,
        },
        (payload: RealtimePostgresChangesPayload<Comment>) => {
          setComments(prev => prev.filter(c => c.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [slideId, supabase, loadComments])

  const addComment = async (content: string, parentId?: string) => {
    const { error } = await supabase
      .from('comments')
      .insert({
        slide_id:  slideId,
        parent_id: parentId ?? null,
        content,
      })
    if (error) throw error
  }

  return { comments, isLoading, addComment }
}
```

### 6.3 실시간 학습 진행률 동기화

```typescript
// hooks/useLearningProgress.ts
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProgressUpdate {
  slideId:             string
  courseId:            string
  chapterId:           string
  status:              'not_started' | 'in_progress' | 'completed'
  timeSpentSeconds:    number
  lastPositionSeconds: number
}

export function useLearningProgress(slideId: string) {
  const supabase      = createClient()
  const timerRef      = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef  = useRef<number>(Date.now())
  const positionRef   = useRef<number>(0)

  // 디바운스된 진행률 저장 (과도한 API 호출 방지)
  const saveProgress = useRef(
    debounce(async (update: ProgressUpdate) => {
      await supabase
        .from('user_progress')
        .upsert(
          {
            slide_id:              update.slideId,
            course_id:             update.courseId,
            chapter_id:            update.chapterId,
            status:                update.status,
            time_spent_seconds:    update.timeSpentSeconds,
            last_position_seconds: update.lastPositionSeconds,
            completed_at:
              update.status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,slide_id' }
        )
    }, 2000)
  ).current

  const updatePosition = (positionSeconds: number) => {
    positionRef.current = positionSeconds
  }

  const markCompleted = async (courseId: string, chapterId: string) => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    await saveProgress({
      slideId:             slideId,
      courseId,
      chapterId,
      status:              'completed',
      timeSpentSeconds:    elapsed,
      lastPositionSeconds: positionRef.current,
    })
  }

  return { updatePosition, markCompleted }
}

// 유틸리티: 디바운스 함수
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```

---

## 7. 스토리지 미디어 에셋 관리

### 7.1 스토리지 버킷 설정

```sql
-- Supabase 대시보드 또는 Management API로 버킷 생성
-- 아래는 SQL 함수를 통한 버킷 정책 설정 예시

-- 썸네일 버킷: 공개 읽기
INSERT INTO storage.buckets (id, name, public)
    VALUES ('thumbnails', 'thumbnails', true);

-- 오디오 요약 버킷: 인증된 사용자만 읽기
INSERT INTO storage.buckets (id, name, public)
    VALUES ('audio-summaries', 'audio-summaries', false);

-- 처리 중인 원본 파이프라인용 버킷: 비공개
INSERT INTO storage.buckets (id, name, public)
    VALUES ('processing-pipeline', 'processing-pipeline', false);
```

### 7.2 스토리지 RLS 정책

```sql
-- 썸네일: 공개 읽기, 강사만 업로드
CREATE POLICY "thumbnails: 공개 읽기"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'thumbnails');

CREATE POLICY "thumbnails: 강사 업로드"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'thumbnails'
        AND public.get_my_role() IN ('instructor', 'org_admin', 'super_admin')
    );

-- 오디오 요약: 수강생만 읽기
CREATE POLICY "audio-summaries: 수강생 읽기"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'audio-summaries'
        AND auth.uid() IS NOT NULL
        -- 경로 형식: {course_id}/{chapter_id}/{slide_id}.mp3
        AND public.is_enrolled(
            (string_to_array(name, '/'))[1]::UUID
        )
    );

-- 파이프라인: Edge Function 서비스 역할만 접근
CREATE POLICY "pipeline: 서비스 역할 전용"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'processing-pipeline'
        AND auth.role() = 'service_role'
    );
```

### 7.3 클라이언트 파일 업로드

```typescript
// lib/storage.ts
import { createClient } from '@/lib/supabase/client'

export async function uploadThumbnail(
  file:      File,
  courseId:  string,
  slideId:   string
): Promise<string> {
  const supabase  = createClient()
  const extension = file.name.split('.').pop()
  const path      = `${courseId}/${slideId}.${extension}`

  const { error } = await supabase.storage
    .from('thumbnails')
    .upload(path, file, {
      cacheControl: '3600',
      upsert:       true,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(path)

  return data.publicUrl
}

export async function getAudioSummaryUrl(
  courseId:  string,
  chapterId: string,
  slideId:   string
): Promise<string> {
  const supabase = createClient()
  const path     = `${courseId}/${chapterId}/${slideId}.mp3`

  const { data, error } = await supabase.storage
    .from('audio-summaries')
    .createSignedUrl(path, 3600) // 1시간 유효 서명 URL

  if (error) throw error
  return data.signedUrl
}
```

---

## 8. Edge Functions 콘텐츠 처리 파이프라인

### 8.1 VOD 슬라이드 처리 파이프라인

```typescript
// supabase/functions/process-slide-content/index.ts
import { serve }       from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ProcessSlidePayload {
  slide_id:      string
  course_id:     string
  raw_text:      string
  thumbnail_url?: string
}

serve(async (req: Request) => {
  try {
    const payload: ProcessSlidePayload = await req.json()

    // 서비스 역할 클라이언트 (RLS 우회)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. media_assets 처리 상태 업데이트
    await supabase
      .from('media_assets')
      .update({ processing_status: 'processing' })
      .eq('slide_id', payload.slide_id)

    // 2. 텍스트 정제 및 HTML 변환
    const cleanedText = cleanRawText(payload.raw_text)
    const contentHtml = markdownToHtml(cleanedText)

    // 3. AI 요약 생성 (OpenAI API 호출)
    const summary = await generateAISummary(cleanedText)

    // 4. 슬라이드 콘텐츠 업데이트
    const { error: slideError } = await supabase
      .from('slides')
      .update({
        content_text: cleanedText,
        content_html: contentHtml,
        metadata:     { ai_summary: summary },
        updated_at:   new Date().toISOString(),
      })
      .eq('id', payload.slide_id)

    if (slideError) throw slideError

    // 5. 오디오 요약 생성 (TTS)
    const audioBuffer = await generateTTS(summary)
    const audioPath   = `${payload.course_id}/${payload.slide_id}.mp3`

    await supabase.storage
      .from('audio-summaries')
      .upload(audioPath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert:      true,
      })

    // 6. 슬라이드의 audio_summary_url 업데이트
    await supabase
      .from('slides')
      .update({ audio_summary_url: audioPath })
      .eq('id', payload.slide_id)

    // 7. 처리 완료 상태 업데이트
    await supabase
      .from('media_assets')
      .update({ processing_status: 'ready' })
      .eq('slide_id', payload.slide_id)

    return new Response(
      JSON.stringify({ success: true, slide_id: payload.slide_id }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('슬라이드 처리 오류:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

function cleanRawText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

function markdownToHtml(text: string): string {
  // 실제 구현에서는 marked 등의 라이브러리 사용
  return `<p>${text.replace(/\n\n/g, '</p><p>')}</p>`
}

async function generateAISummary(text: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:    'gpt-4o-mini',
      messages: [
        {
          role:    'system',
          content: '당신은 교육 콘텐츠 요약 전문가입니다. 핵심 개념을 3-5문장으로 요약해주세요.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 300,
    }),
  })

  const data = await response.json()
  return data.choices[0].message.content
}

async function generateTTS(text: string): Promise<ArrayBuffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:  'tts-1',
      input:  text,
      voice:  'alloy',
      format: 'mp3',
    }),
  })

  return response.arrayBuffer()
}
```

### 8.2 Webhook 트리거 (Database Hook)

```sql
-- 새 슬라이드 생성 시 처리 파이프라인 자동 트리거
-- Supabase 대시보드 > Database > Webhooks 에서 설정하거나
-- 아래 pg_net 확장을 사용한 SQL 트리거 활용

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_slide_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Edge Function 호출 (비동기)
    PERFORM net.http_post(
        url:=    current_setting('app.supabase_functions_url') || '/process-slide-content',
        headers:= jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body:=   jsonb_build_object(
            'slide_id',  NEW.id,
            'course_id', (
                SELECT ch.course_id
                FROM public.chapters ch
                WHERE ch.id = NEW.chapter_id
            ),
            'raw_text', NEW.content_text
        )
    );

    -- media_assets 레코드 생성
    INSERT INTO public.media_assets (slide_id, asset_type, storage_path, processing_status)
    VALUES (NEW.id, 'audio', '', 'pending');

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_slide_created_process
    AFTER INSERT ON public.slides
    FOR EACH ROW
    WHEN (NEW.content_text IS NOT NULL AND NEW.content_text != '')
    EXECUTE FUNCTION public.trigger_slide_processing();
```

---

## 9. Next.js 연동 패턴

### 9.1 Supabase 클라이언트 설정

```typescript
// lib/supabase/server.ts  (서버 컴포넌트용)
import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import type { Database }      from '@/types/supabase'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts  (클라이언트 컴포넌트용)
import { createBrowserClient } from '@supabase/ssr'
import type { Database }       from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// middleware.ts  (세션 갱신 미들웨어)
import { createServerClient }     from '@supabase/ssr'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (필수)
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 9.2 서버 컴포넌트 패턴

```tsx
// app/courses/[slug]/page.tsx  (서버 컴포넌트)
import { createClient }  from '@/lib/supabase/server'
import { notFound }      from 'next/navigation'
import { CoursePlayer }  from '@/components/CoursePlayer'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CoursePage({ params }: PageProps) {
  const { slug }  = await params
  const supabase  = await createClient()

  // 세션 확인
  const { data: { user } } = await supabase.auth.getUser()

  // 강좌 데이터 조회 (RLS 자동 적용)
  const { data: course, error } = await supabase
    .from('courses')
    .select(`
      *,
      profiles (
        full_name,
        avatar_url
      ),
      chapters (
        id,
        title,
        order_index,
        is_free_preview,
        slides (
          id,
          title,
          slide_type,
          order_index,
          duration_seconds,
          thumbnail_url
        )
      )
    `)
    .eq('slug', slug)
    .single()

  if (error || !course) notFound()

  // 수강 여부 확인
  let isEnrolled = false
  if (user) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .eq('status', 'active')
      .maybeSingle()

    isEnrolled = !!enrollment
  }

  return (
    <CoursePlayer
      course={course}
      isEnrolled={isEnrolled}
      userId={user?.id}
    />
  )
}

// 정적 경로 생성 (ISR)
export async function generateStaticParams() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('courses')
    .select('slug')
    .eq('status', 'published')

  return (data ?? []).map(c => ({ slug: c.slug }))
}

// 재검증 주기 설정
export const revalidate = 3600 // 1시간
```

### 9.3 클라이언트 컴포넌트 패턴

```tsx
// components/CoursePlayer.tsx  (클라이언트 컴포넌트)
'use client'

import { useState, useCallback }  from 'react'
import { createClient }           from '@/lib/supabase/client'
import { useSlideComments }       from '@/hooks/useSlideComments'
import { useLearningProgress }    from '@/hooks/useLearningProgress'

interface CoursePlayerProps {
  course:     any  // 실제 프로젝트에서는 생성된 타입 사용
  isEnrolled: boolean
  userId?:    string
}

export function CoursePlayer({ course, isEnrolled, userId }: CoursePlayerProps) {
  const [currentSlideId, setCurrentSlideId] = useState<string>(
    course.chapters[0]?.slides[0]?.id ?? ''
  )

  const { comments, addComment } = useSlideComments(currentSlideId)
  const { markCompleted }        = useLearningProgress(currentSlideId)

  const handleSlideComplete = useCallback(async () => {
    const currentSlide = course.chapters
      .flatMap((ch: any) => ch.slides)
      .find((s: any) => s.id === currentSlideId)

    if (!currentSlide || !isEnrolled) return

    const chapter = course.chapters.find((ch: any) =>
      ch.slides.some((s: any) => s.id === currentSlideId)
    )

    await markCompleted(course.id, chapter.id)
  }, [currentSlideId, course, isEnrolled, markCompleted])

  return (
    <div className="flex h-screen">
      {/* 목차 사이드바 */}
      <aside className="w-64 border-r overflow-y-auto">
        {course.chapters
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((chapter: any) => (
            <div key={chapter.id}>
              <h3 className="font-bold p-3">{chapter.title}</h3>
              {chapter.slides
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((slide: any) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlideId(slide.id)}
                    className={`w-full text-left p-2 pl-6 text-sm hover:bg-gray-100 ${
                      currentSlideId === slide.id ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    {slide.title}
                    {!isEnrolled && !chapter.is_free_preview && (
                      <span className="ml-2 text-xs text-gray-400">잠금</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto p-6">
        <SlideViewer
          slideId={currentSlideId}
          onComplete={handleSlideComplete}
        />

        {/* 실시간 댓글 */}
        {isEnrolled && (
          <CommentSection
            comments={comments}
            onAddComment={addComment}
          />
        )}
      </main>
    </div>
  )
}

function SlideViewer({ slideId, onComplete }: {
  slideId:    string
  onComplete: () => void
}) {
  const supabase = createClient()
  const [slide, setSlide] = useState<any>(null)

  // 슬라이드 변경 시 데이터 로드
  useState(() => {
    supabase
      .from('slides')
      .select('*')
      .eq('id', slideId)
      .single()
      .then(({ data }) => setSlide(data))
  })

  if (!slide) return <div>로딩 중...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{slide.title}</h2>
      <div
        dangerouslySetInnerHTML={{ __html: slide.content_html ?? '' }}
        className="prose max-w-none"
      />
      <button
        onClick={onComplete}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        학습 완료
      </button>
    </div>
  )
}

function CommentSection({ comments, onAddComment }: {
  comments:      any[]
  onAddComment:  (content: string) => Promise<void>
}) {
  const [input, setInput] = useState('')

  const handleSubmit = async () => {
    if (!input.trim()) return
    await onAddComment(input.trim())
    setInput('')
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-4">질문 및 토론 ({comments.length})</h3>
      <div className="space-y-4 mb-4">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-3">
            <img
              src={comment.profiles.avatar_url ?? '/default-avatar.png'}
              alt={comment.profiles.full_name}
              className="w-8 h-8 rounded-full"
            />
            <div>
              <span className="font-medium">{comment.profiles.full_name}</span>
              <p className="text-sm mt-1">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="flex-1 border rounded px-3 py-2"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          작성
        </button>
      </div>
    </div>
  )
}
```

### 9.4 서버 액션 (Server Actions)

```typescript
// app/courses/[slug]/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function enrollCourse(courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('enrollments')
    .insert({
      user_id:   user.id,
      course_id: courseId,
      status:    'active',
    })

  if (error) {
    if (error.code === '23505') {
      throw new Error('이미 수강 중인 강좌입니다.')
    }
    throw error
  }

  revalidatePath(`/courses`)
  return { success: true }
}

export async function updateSlideProgress(
  slideId:             string,
  courseId:            string,
  chapterId:           string,
  status:              'in_progress' | 'completed',
  timeSpentSeconds:    number,
  lastPositionSeconds: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('user_progress')
    .upsert(
      {
        user_id:               user.id,
        slide_id:              slideId,
        course_id:             courseId,
        chapter_id:            chapterId,
        status,
        time_spent_seconds:    timeSpentSeconds,
        last_position_seconds: lastPositionSeconds,
        completed_at:          status === 'completed' ? new Date().toISOString() : null,
        updated_at:            new Date().toISOString(),
      },
      { onConflict: 'user_id,slide_id' }
    )

  if (error) throw error
  return { success: true }
}
```

---

## 10. 학습 진행률 추적 구현

### 10.1 진행률 집계 뷰 (PostgreSQL View)

```sql
-- 강좌별 전체 진행률 계산 뷰
CREATE OR REPLACE VIEW public.course_progress_summary AS
SELECT
    up.user_id,
    up.course_id,
    COUNT(DISTINCT s.id)                                         AS total_slides,
    COUNT(DISTINCT CASE WHEN up.status = 'completed'
                        THEN up.slide_id END)                    AS completed_slides,
    ROUND(
        COUNT(DISTINCT CASE WHEN up.status = 'completed'
                            THEN up.slide_id END)::NUMERIC
        / NULLIF(COUNT(DISTINCT s.id), 0) * 100,
        2
    )                                                            AS completion_percentage,
    SUM(up.time_spent_seconds)                                   AS total_time_spent,
    MAX(up.updated_at)                                           AS last_activity_at,
    BOOL_AND(up.status = 'completed')                            AS is_course_completed
FROM public.user_progress up
JOIN public.slides s ON s.id = up.slide_id
GROUP BY up.user_id, up.course_id;

-- 뷰에 RLS 적용 (뷰는 별도 RLS 없이 기반 테이블의 RLS 상속)
```

### 10.2 챕터별 진행률 함수

```sql
-- 챕터별 세부 진행률 조회 함수
CREATE OR REPLACE FUNCTION public.get_chapter_progress(
    p_user_id   UUID,
    p_course_id UUID
)
RETURNS TABLE (
    chapter_id          UUID,
    chapter_title       TEXT,
    chapter_order       INTEGER,
    total_slides        BIGINT,
    completed_slides    BIGINT,
    completion_percent  NUMERIC,
    total_time_spent    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        ch.id                                                    AS chapter_id,
        ch.title                                                 AS chapter_title,
        ch.order_index                                           AS chapter_order,
        COUNT(DISTINCT s.id)                                     AS total_slides,
        COUNT(DISTINCT CASE WHEN up.status = 'completed'
                            THEN s.id END)                       AS completed_slides,
        ROUND(
            COUNT(DISTINCT CASE WHEN up.status = 'completed'
                                THEN s.id END)::NUMERIC
            / NULLIF(COUNT(DISTINCT s.id), 0) * 100,
            2
        )                                                        AS completion_percent,
        COALESCE(SUM(up.time_spent_seconds), 0)                 AS total_time_spent
    FROM public.chapters ch
    JOIN public.slides s ON s.chapter_id = ch.id
    LEFT JOIN public.user_progress up
        ON up.slide_id = s.id
        AND up.user_id = p_user_id
    WHERE ch.course_id = p_course_id
    GROUP BY ch.id, ch.title, ch.order_index
    ORDER BY ch.order_index;
$$;
```

### 10.3 마지막 학습 위치 복원

```typescript
// lib/progress.ts
import { createClient } from '@/lib/supabase/server'

export async function getLastStudiedSlide(
  courseId: string
): Promise<{ slideId: string; position: number } | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_progress')
    .select('slide_id, last_position_seconds, updated_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    slideId:  data.slide_id,
    position: data.last_position_seconds,
  }
}

export async function getCourseProgressSummary(courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('course_progress_summary')
    .select('*')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  return data
}
```

### 10.4 진행률 대시보드 컴포넌트

```tsx
// components/ProgressDashboard.tsx
import { getCourseProgressSummary } from '@/lib/progress'
import { createClient }             from '@/lib/supabase/server'

interface ProgressDashboardProps {
  courseId: string
}

export async function ProgressDashboard({ courseId }: ProgressDashboardProps) {
  const supabase = await createClient()
  const progress = await getCourseProgressSummary(courseId)

  // 챕터별 진행률 조회
  const { data: { user } } = await supabase.auth.getUser()
  const { data: chapterProgress } = await supabase
    .rpc('get_chapter_progress', {
      p_user_id:   user!.id,
      p_course_id: courseId,
    })

  if (!progress) {
    return <div className="text-gray-500">학습을 시작해주세요.</div>
  }

  const totalHours  = Math.floor((progress.total_time_spent ?? 0) / 3600)
  const totalMinutes = Math.floor(((progress.total_time_spent ?? 0) % 3600) / 60)

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">학습 진행 현황</h2>

      {/* 전체 진행률 */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">전체 진행률</span>
          <span className="text-sm font-bold text-blue-600">
            {progress.completion_percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${progress.completion_percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {progress.completed_slides} / {progress.total_slides} 슬라이드 완료
        </p>
      </div>

      {/* 총 학습 시간 */}
      <div className="mb-6 p-3 bg-gray-50 rounded">
        <p className="text-sm text-gray-600">총 학습 시간</p>
        <p className="text-2xl font-bold">
          {totalHours > 0 && `${totalHours}시간 `}{totalMinutes}분
        </p>
      </div>

      {/* 챕터별 진행률 */}
      <div>
        <h3 className="font-medium mb-3">챕터별 진행률</h3>
        <div className="space-y-3">
          {(chapterProgress ?? []).map((ch: any) => (
            <div key={ch.chapter_id}>
              <div className="flex justify-between text-sm mb-1">
                <span>{ch.chapter_title}</span>
                <span className="text-gray-500">
                  {ch.completed_slides}/{ch.total_slides}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${ch.completion_percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 수료 뱃지 */}
      {progress.is_course_completed && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
          <span className="text-2xl">🎓</span>
          <p className="font-bold text-yellow-800 mt-1">강좌를 수료하셨습니다!</p>
        </div>
      )}
    </div>
  )
}
```

---

## 11. 성능 최적화 및 인덱싱

### 11.1 핵심 인덱스

```sql
-- 강좌 조회 최적화
CREATE INDEX idx_courses_status          ON public.courses (status);
CREATE INDEX idx_courses_org_id          ON public.courses (organization_id);
CREATE INDEX idx_courses_author_id       ON public.courses (author_id);
CREATE INDEX idx_courses_tags            ON public.courses USING GIN (tags);

-- 챕터/슬라이드 조회 최적화
CREATE INDEX idx_chapters_course_id      ON public.chapters (course_id, order_index);
CREATE INDEX idx_slides_chapter_id       ON public.slides (chapter_id, order_index);
CREATE INDEX idx_slides_fts              ON public.slides USING GIN (fts_vector);

-- 수강/진행률 조회 최적화
CREATE INDEX idx_enrollments_user_id     ON public.enrollments (user_id, status);
CREATE INDEX idx_enrollments_course_id   ON public.enrollments (course_id);
CREATE INDEX idx_user_progress_user_id   ON public.user_progress (user_id, course_id);
CREATE INDEX idx_user_progress_slide_id  ON public.user_progress (slide_id);
CREATE INDEX idx_user_progress_updated   ON public.user_progress (updated_at DESC);

-- 댓글 조회 최적화
CREATE INDEX idx_comments_slide_id       ON public.comments (slide_id, created_at);
CREATE INDEX idx_comments_user_id        ON public.comments (user_id);
CREATE INDEX idx_comments_parent_id      ON public.comments (parent_id)
    WHERE parent_id IS NOT NULL;

-- 북마크 조회 최적화
CREATE INDEX idx_bookmarks_user_id       ON public.bookmarks (user_id);
```

### 11.2 업데이트 타임스탬프 자동화

```sql
-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 각 테이블에 트리거 적용
CREATE TRIGGER set_updated_at_courses
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_slides
    BEFORE UPDATE ON public.slides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_chapters
    BEFORE UPDATE ON public.chapters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_user_progress
    BEFORE UPDATE ON public.user_progress
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_comments
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 11.3 환경 변수 설정

```bash
# .env.local (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 서버 전용 (클라이언트에 노출 금지)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Edge Functions
OPENAI_API_KEY=your-openai-key
```

### 11.4 타입 자동 생성 (CLI)

```bash
# Supabase CLI로 TypeScript 타입 자동 생성
npx supabase gen types typescript \
  --project-id your-project-id \
  --schema public \
  > types/supabase.ts
```

---

## 요약 체크리스트

| 항목 | 설명 | 구현 완료 여부 |
|---|---|---|
| 스키마 설계 | 8개 핵심 테이블 + 연관 관계 | ERD 및 SQL 완료 |
| RLS 정책 | 역할 기반 행 수준 보안 | 헬퍼 함수 + 정책 완료 |
| 전문 검색 | tsvector + pg_trgm 조합 | 검색 함수 완료 |
| 실시간 구독 | 댓글, 진행률 WebSocket | React 훅 완료 |
| 스토리지 | 썸네일, 오디오 버킷 분리 | RLS + 업로드 함수 완료 |
| Edge Functions | AI 요약, TTS 파이프라인 | Deno 함수 완료 |
| Next.js 연동 | SSR + 클라이언트 컴포넌트 | 서버/클라이언트 분리 완료 |
| 진행률 추적 | 뷰 + 집계 함수 + 복원 | 대시보드 컴포넌트 완료 |
| 성능 최적화 | 인덱스 + 트리거 | 핵심 인덱스 완료 |