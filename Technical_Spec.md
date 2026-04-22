# Technical Specification — AIX 파이프라인 + 인터랙티브 슬라이드 플랫폼

**버전**: 1.0.0  
**작성일**: 2026-04-20  
**상태**: 설계 확정 (구현 전)  
**작성자**: Senior Architect (AI 자율 권한)  
**연관 문서**: [PRD.md](./PRD.md), [CLAUDE.md](./CLAUDE.md)

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [에이전트 인터페이스 계약 (JSON 규격)](#2-에이전트-인터페이스-계약-json-규격)
3. [Supabase 데이터베이스 스키마](#3-supabase-데이터베이스-스키마)
4. [파이프라인 상태 기계 명세](#4-파이프라인-상태-기계-명세)
5. [에러 코드 전체 카탈로그](#5-에러-코드-전체-카탈로그)
6. [환경 변수 및 설정](#6-환경-변수-및-설정)
7. [Next.js 프론트엔드 아키텍처](#7-nextjs-프론트엔드-아키텍처)
8. [API Fetch 명세 (Frontend ↔ Supabase)](#8-api-fetch-명세-frontend--supabase)
9. [파일 시스템 구조](#9-파일-시스템-구조)
10. [의존성 목록](#10-의존성-목록)
11. [구현 순서 가이드](#11-구현-순서-가이드)

---

## 1. 시스템 아키텍처 개요

### 1.0 전체 사용자 흐름 (End-to-End)

```
[사용자 수동 단계]
유튜브 / 컨퍼런스 영상
        │
        ▼  (사용자가 직접 NotebookLM에 영상 URL 투입)
  NotebookLM
        │  → 핵심 내용 요약·구조화 → .md 파일 생성
        ▼
  로컬 /inputs 폴더에 .md 저장
        │
        ▼  python run.py 실행 (자동화 시작)

[자동화 단계 — 본 파이프라인]
```

### 1.1 파이프라인 상세 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        PIPELINE (Python)                         │
│                                                                   │
│  /inputs/*.md   ← NotebookLM이 생성한 영상 요약 .md 파일         │
│       │                                                           │
│       ▼                                                           │
│  ┌──────────┐    FileQueue    ┌──────────┐   ParsedDocument       │
│  │ scanner  │ ─────────────► │  parser  │ ────────────────┐      │
│  └──────────┘                └──────────┘                 │      │
│                                    ↑ repair (max 2x)      │      │
│                               ┌──────────┐                │      │
│                               │  repair  │ ◄──────────────┤      │
│                               └──────────┘  ValidationResult     │
│                                    │                      │      │
│                               ┌──────────┐                │      │
│                               │validator │ ◄──────────────┘      │
│                               └──────────┘                        │
│                                    │ ValidatedDocument             │
│                                    ▼                              │
│                               ┌──────────┐   UploadResult        │
│                               │ uploader │ ──────────────┐       │
│                               └──────────┘               │       │
│                                                          ▼       │
│                               ┌──────────┐  EvaluationReport     │
│                               │evaluator │ ──────────────────►   │
│                               └──────────┘   /processed  /state  │
│                                                                   │
│  [모든 에이전트는 pipeline_commander(run.py)를 통해서만 호출됨]    │
└─────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
              ┌───────────────────┐  ┌──────────────────┐
              │   Supabase DB      │  │ Supabase Storage │
              │  knowledge_slides  │  │   md-backups/    │
              │  pipeline_log      │  └──────────────────┘
              │  courses           │
              │  tags              │
              └───────────────────┘
                          │
                          ▼
              ┌───────────────────┐
              │  Next.js (Vercel)  │
              │  슬라이드 뷰어     │
              │  지식 검색 UI      │
              └───────────────────┘
```

---

## 2. 에이전트 인터페이스 계약 (JSON 규격)

모든 에이전트는 Python dataclass로 구현되며, 아래 JSON은 각 인터페이스의 직렬화 형식이다.

### 2.1 MdFileInfo (Scanner → Parser 전달)

```json
{
  "path": "/inputs/01_파이썬기초.md",
  "name": "01_파이썬기초.md",
  "stem": "01_파이썬기초",
  "session_number": 1,
  "title": "파이썬기초",
  "size_bytes": 2340,
  "encoding": "utf-8",
  "content": "---\ncourseId: python-101\ntitle: 파이썬 기초\n---\n\n# 변수와 자료형\n..."
}
```

**제약사항**:
- `size_bytes` ≤ 5,242,880 (5MB) — 초과 시 scanner가 WARN + 스킵
- `size_bytes` ≥ 10 — 미만 시 빈 파일로 WARN + 스킵
- `encoding` 허용값: `"utf-8"`, `"utf-8-sig"`, `"cp949"`, `"euc-kr"`, `"latin-1"`

### 2.2 ParsedDocument (Parser → Validator 전달)

```json
{
  "source_file": "01_파이썬기초.md",
  "raw_md_hash": "a1b2c3d4e5f6g7h8",
  "degraded": false,
  "_auto_generated": false,
  "meta": {
    "courseId": "python-101",
    "title": "파이썬 기초",
    "order": 1,
    "level": "beginner",
    "duration": 30,
    "tags": ["python", "basics", "variables"],
    "author": "홍길동"
  },
  "slides": [
    {
      "index": 0,
      "title": "변수와 자료형",
      "layout": "default",
      "blocks": [
        {
          "type": "heading",
          "depth": 1,
          "text": "변수와 자료형"
        },
        {
          "type": "paragraph",
          "text": "파이썬에서 변수는 값을 담는 그릇입니다."
        },
        {
          "type": "code",
          "lang": "python",
          "text": "x = 42\nname = 'Alice'\npi = 3.14"
        }
      ],
      "notes": "이 슬라이드에서는 int, str, float 세 가지 타입을 다룹니다."
    },
    {
      "index": 1,
      "title": "리스트와 딕셔너리",
      "layout": "bullet-list",
      "blocks": [
        {
          "type": "list",
          "ordered": false,
          "items": [
            {"text": "리스트: 순서 있는 컬렉션"},
            {"text": "딕셔너리: 키-값 쌍"},
            {"text": "튜플: 불변 시퀀스"}
          ]
        }
      ],
      "notes": null
    }
  ],
  "error": null
}
```

**ParseError 형식** (실패 시):
```json
{
  "source_file": "03_오류파일.md",
  "raw_md_hash": null,
  "degraded": false,
  "meta": {},
  "slides": [],
  "error": {
    "code": "NO_SLIDES",
    "message": "--- 구분자 없음, H2 헤딩도 없음",
    "recoverable": true
  }
}
```

### 2.3 ContentBlock 상세 스펙

```json
// paragraph
{"type": "paragraph", "text": "문단 내용"}

// heading
{"type": "heading", "depth": 1, "text": "제목"}  // depth: 1~6

// code
{"type": "code", "lang": "python", "text": "print('hello')"}
// lang이 없으면 validator WARN 발생

// list
{
  "type": "list",
  "ordered": false,
  "items": [
    {"text": "항목 1"},
    {"text": "항목 2", "children": [{"text": "중첩 항목"}]}
  ]
}

// blockquote
{"type": "blockquote", "text": "인용 내용"}

// table
{
  "type": "table",
  "headers": ["이름", "타입", "설명"],
  "rows": [
    ["x", "int", "정수형 변수"],
    ["name", "str", "문자열 변수"]
  ]
}

// image
{"type": "image", "url": "https://...", "alt": "설명 텍스트", "title": null}
// alt 없으면 validator WARN 발생

// divider
{"type": "divider"}
```

### 2.4 ValidationResult (Validator → pipeline_commander)

```json
{
  "ok": false,
  "parsed": { /* ParsedDocument 전체 */ },
  "errors": [
    {
      "code": "INVALID_SLUG",
      "field": "meta.courseId",
      "message": "courseId 'Python 101'에 공백 포함, slug 형식 위반",
      "fixable": true
    }
  ],
  "warnings": [
    "slide[2].blocks[0]: code 블록에 lang 미지정",
    "image 블록 alt 없음: slide[1].blocks[2]"
  ]
}
```

### 2.5 RepairRequest (pipeline_commander → repair_agent)

```json
{
  "attempt": 1,
  "source": "validator",
  "file_info": { /* MdFileInfo */ },
  "data": { /* ParsedDocument 또는 ValidationResult */ },
  "errors": [
    {"code": "INVALID_SLUG", "field": "meta.courseId", "fixable": true}
  ]
}
```

### 2.6 RepairResult (repair_agent → pipeline_commander)

```json
{
  "success": true,
  "data": { /* 수정된 ParsedDocument */ },
  "applied_fixes": [
    "meta.courseId 'Python 101' → 'python-101' (slugify 적용)"
  ],
  "error": null
}
```

**실패 시**:
```json
{
  "success": false,
  "data": null,
  "applied_fixes": ["H2 기준 재분리 시도", "전체 단일 슬라이드 병합 시도"],
  "error": "2회 복구 실패 — QUARANTINE 처리 요청"
}
```

### 2.7 UploadResult (uploader_agent → evaluator_agent)

```json
{
  "success": true,
  "source_file": "01_파이썬기초.md",
  "course_id": "python-101",
  "uploaded_slide_ids": [
    "uuid-1", "uuid-2", "uuid-3", "uuid-4", "uuid-5", "uuid-6"
  ],
  "expected_count": 6,
  "actual_count": 6,
  "storage_path": "python-101/01_파이썬기초.md",
  "fatal": false,
  "error": null,
  "raw_md_hash": "a1b2c3d4e5f6g7h8"
}
```

### 2.8 EvaluationReport (evaluator_agent → pipeline_commander)

```json
{
  "source_file": "01_파이썬기초.md",
  "match": true,
  "expected_count": 6,
  "actual_db_count": 6,
  "missing_slide_indices": [],
  "disposition": "processed",
  "evaluated_at": "2026-04-20T14:30:00Z"
}
```

---

## 3. Supabase 데이터베이스 스키마

### 3.1 `courses` 테이블 (신규 — 지식 자산화)

```sql
CREATE TABLE courses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id       TEXT NOT NULL UNIQUE,           -- slug: "python-101"
    title           TEXT NOT NULL,                  -- "파이썬 기초"
    description     TEXT,                           -- 코스 설명 (optional)
    level           TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    author          TEXT,
    total_slides    INTEGER DEFAULT 0,              -- 집계, uploader가 갱신
    total_duration  INTEGER DEFAULT 0,              -- 분 단위
    thumbnail_url   TEXT,                           -- 첫 슬라이드 기반 생성 (Phase 2)
    is_published    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_level ON courses(level);
CREATE INDEX idx_courses_published ON courses(is_published);
```

### 3.2 `tags` 테이블 (신규 — 태그 정규화)

```sql
CREATE TABLE tags (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,               -- "python", "basics"
    slug        TEXT NOT NULL UNIQUE,               -- "python", "basics" (소문자)
    usage_count INTEGER DEFAULT 0,                  -- 인기도 집계
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);
```

### 3.3 `course_tags` 테이블 (신규 — N:M 관계)

```sql
CREATE TABLE course_tags (
    course_id   TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, tag_id)
);
```

### 3.4 `knowledge_slides` 테이블 (기존 + 확장)

```sql
CREATE TABLE knowledge_slides (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_file     TEXT NOT NULL,                  -- "01_파이썬기초.md"
    slide_index     INTEGER NOT NULL,               -- 0부터 시작
    course_id       TEXT NOT NULL REFERENCES courses(course_id),
    title           TEXT,                           -- slide.title
    content_json    JSONB NOT NULL,                 -- SlideData 전체
    layout          TEXT,                           -- 빠른 필터링용 역정규화
    tags            TEXT[] DEFAULT '{}',            -- meta.tags (비정규화 유지)
    raw_md_hash     TEXT,                           -- 변경 감지용 SHA256 앞 16자
    degraded        BOOLEAN DEFAULT false,          -- repair_agent 처리 여부
    is_searchable   BOOLEAN DEFAULT true,           -- 검색 인덱스 포함 여부
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (source_file, slide_index),
    CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- 성능 인덱스
CREATE INDEX idx_slides_course_id ON knowledge_slides(course_id);
CREATE INDEX idx_slides_course_index ON knowledge_slides(course_id, slide_index);
CREATE INDEX idx_slides_layout ON knowledge_slides(layout);
CREATE INDEX idx_slides_tags ON knowledge_slides USING gin(tags);
CREATE INDEX idx_slides_content ON knowledge_slides USING gin(content_json);
CREATE INDEX idx_slides_hash ON knowledge_slides(raw_md_hash);

-- Full-Text Search (Phase 2, 한국어 지원)
-- CREATE INDEX idx_slides_fts ON knowledge_slides
--   USING gin(to_tsvector('simple', coalesce(title, '')));
```

### 3.5 `pipeline_log` 테이블 (기존 + 확장)

```sql
CREATE TABLE pipeline_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id          TEXT NOT NULL,                  -- pipeline_state.run_id
    source_file     TEXT NOT NULL,
    course_id       TEXT,
    slide_count     INTEGER DEFAULT 0,
    disposition     TEXT NOT NULL,                  -- "processed" | "quarantined" | "dead_letter" | "skipped"
    error_codes     TEXT[] DEFAULT '{}',            -- 발생한 에러 코드 목록
    repair_attempts INTEGER DEFAULT 0,              -- 복구 시도 횟수
    raw_md_hash     TEXT,
    duration_ms     INTEGER,                        -- 단일 파일 처리 시간 (밀리초)
    processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_log_run_id ON pipeline_log(run_id);
CREATE INDEX idx_log_disposition ON pipeline_log(disposition);
CREATE INDEX idx_log_course_id ON pipeline_log(course_id);
CREATE INDEX idx_log_processed_at ON pipeline_log(processed_at DESC);
```

### 3.6 `pipeline_runs` 테이블 (신규 — 실행 이력)

```sql
CREATE TABLE pipeline_runs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id          TEXT NOT NULL UNIQUE,
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    duration_seconds NUMERIC(10,2),
    total_files     INTEGER DEFAULT 0,
    processed       INTEGER DEFAULT 0,
    quarantined     INTEGER DEFAULT 0,
    dead_letter     INTEGER DEFAULT 0,
    skipped         INTEGER DEFAULT 0,
    total_slides    INTEGER DEFAULT 0,
    parse_success_rate NUMERIC(5,2),               -- processed/total * 100
    status          TEXT DEFAULT 'running',         -- "running" | "completed" | "failed"
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 RLS (Row Level Security) 정책

```sql
-- knowledge_slides: 공개 읽기 (anon), 쓰기는 service_role만
ALTER TABLE knowledge_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read slides"
    ON knowledge_slides FOR SELECT
    USING (is_searchable = true);

-- courses: 공개 읽기
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read courses"
    ON courses FOR SELECT
    USING (is_published = true);

-- tags: 공개 읽기
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tags" ON tags FOR SELECT USING (true);

-- pipeline_log, pipeline_runs: service_role만 (RLS 비활성화 또는 정책 없음)
```

### 3.8 DB 함수 (Stored Procedures)

```sql
-- 코스 슬라이드 수 집계 자동 갱신 (uploader 완료 후 호출)
CREATE OR REPLACE FUNCTION update_course_stats(p_course_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE courses
    SET
        total_slides = (
            SELECT COUNT(*) FROM knowledge_slides
            WHERE course_id = p_course_id
        ),
        updated_at = NOW()
    WHERE course_id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 태그 사용 횟수 집계
CREATE OR REPLACE FUNCTION refresh_tag_counts()
RETURNS void AS $$
BEGIN
    UPDATE tags t
    SET usage_count = (
        SELECT COUNT(*) FROM course_tags ct WHERE ct.tag_id = t.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. 파이프라인 상태 기계 명세

### 4.1 pipeline_state.json 스키마

```json
{
  "$schema": "pipeline_state_v1",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": "2026-04-20T14:00:00Z",
  "current_file": "02_함수와클래스.md",
  "stage": "UPLOADING",
  "retry_count": 0,
  "processed": ["01_파이썬기초.md"],
  "quarantined": [],
  "dead_letter": [],
  "stats": {
    "total": 5,
    "success": 1,
    "failed": 0,
    "skipped": 0,
    "total_slides_uploaded": 6
  },
  "last_updated": "2026-04-20T14:05:23Z"
}
```

### 4.2 상태 전이 테이블

| 현재 상태 | 이벤트 | 다음 상태 | 행동 |
|----------|--------|----------|------|
| `IDLE` | `run.py` 실행 | `SCANNING` | state 로드 또는 초기화 |
| `SCANNING` | 성공 | `PARSING` | FileQueue 생성 |
| `SCANNING` | 실패 (폴더 없음) | `DONE` | WARN + 빈 큐 반환 |
| `PARSING` | 성공 | `VALIDATING` | ParsedDocument 생성 |
| `PARSING` | 실패 | `REPAIRING` | repair_agent 호출 |
| `REPAIRING` | 성공 (1회) | `VALIDATING` | 수정된 데이터 검증 |
| `REPAIRING` | 성공 (2회) | `VALIDATING` | degraded=true |
| `REPAIRING` | 실패 (2회) | `QUARANTINE` | 파일 격리 + 다음 파일 |
| `VALIDATING` | 성공 | `UPLOADING` | ValidatedDocument 준비 |
| `VALIDATING` | 실패 (fixable) | `REPAIRING` | repair_agent 호출 |
| `VALIDATING` | 실패 (not fixable) | `QUARANTINE` | 파일 격리 |
| `UPLOADING` | 성공 | `EVALUATING` | UploadResult 생성 |
| `UPLOADING` | 실패 (재시도 소진) | `DEAD_LETTER` | FATAL + 파이프라인 중단 |
| `EVALUATING` | match=true | `DONE` (파일) | /processed 이동 |
| `EVALUATING` | match=false | `UPLOADING` (재시도) | 누락 슬라이드 재업로드 |
| `EVALUATING` | 2차 불일치 | `DONE` (manual_review) | 경고 + 계속 |
| `QUARANTINE` | - | `SCANNING` (다음 파일) | 다음 파일로 진행 |
| `DEAD_LETTER` | - | `TERMINATED` | state 저장 + 즉시 종료 |

---

## 5. 에러 코드 전체 카탈로그

### 5.1 Scanner 에러

| 코드 | 수준 | fixable | 설명 |
|------|------|---------|------|
| `SCANNER_DIR_MISSING` | WARN | - | /inputs 폴더 없음 (자동 생성) |
| `SCANNER_EMPTY_QUEUE` | WARN | - | .md 파일 0개 |
| `SCANNER_FILE_TOO_SMALL` | WARN | - | 파일 크기 < 10 bytes |
| `SCANNER_FILE_TOO_LARGE` | WARN | - | 파일 크기 > 5MB |
| `SCANNER_ENCODING_FAILED` | WARN | - | 5단계 인코딩 폴백 모두 실패 |
| `SCANNER_PERMISSION_DENIED` | WARN | - | 파일 읽기 권한 없음 |
| `SCANNER_BINARY_CONTENT` | WARN | - | null byte 포함 이진 파일 |
| `SCANNER_DUPLICATE_STEM` | WARN | - | 동일 stem 파일명 중복 |

### 5.2 Parser 에러

| 코드 | 수준 | fixable | 설명 |
|------|------|---------|------|
| `FRONTMATTER_MISSING` | ERROR | True | YAML frontmatter 없음 |
| `FRONTMATTER_SYNTAX` | ERROR | True | YAML 문법 오류 |
| `NO_SLIDES` | ERROR | True | 슬라이드 분리 실패 (0개) |
| `PARSE_EXCEPTION` | ERROR | True | mistune 파싱 예외 |
| `ENCODING_ERROR` | ERROR | True | 인코딩 변환 오류 |

### 5.3 Validator 에러

| 코드 | 수준 | fixable | 설명 |
|------|------|---------|------|
| `MISSING_COURSE_ID` | FATAL | False | courseId 완전 누락 |
| `MISSING_TITLE` | ERROR | True | meta.title 없음 |
| `INVALID_SLUG` | ERROR | True | courseId slug 형식 위반 |
| `NEGATIVE_DURATION` | ERROR | True | duration 음수 |
| `INVALID_LEVEL` | ERROR | True | level 허용 범위 밖 |
| `DUPLICATE_SLIDE_INDEX` | ERROR | True | 슬라이드 인덱스 중복 |
| `TITLE_TOO_LONG` | ERROR | True | title 200자 초과 |
| `NO_SLIDES` | ERROR | True | slides 배열 비어있음 |
| `SLIDE_COUNT_HIGH` | WARN | - | 슬라이드 50개 초과 |
| `CODE_NO_LANG` | WARN | - | 코드 블록 lang 없음 |
| `IMAGE_NO_ALT` | WARN | - | 이미지 alt 없음 |
| `DURATION_MISMATCH` | WARN | - | duration vs 슬라이드 수 불일치 |

### 5.4 Uploader 에러

| 코드 | 수준 | fixable | 설명 |
|------|------|---------|------|
| `UPLOAD_AUTH_ERROR` | FATAL | False | Supabase 인증 실패 (401) |
| `UPLOAD_PERMISSION_ERROR` | FATAL | False | RLS/권한 위반 (403) |
| `UPLOAD_RETRY_EXHAUSTED` | FATAL | False | 3회 재시도 소진 |
| `UPLOAD_TIMEOUT` | ERROR | True | 네트워크 타임아웃 (tenacity 재시도) |
| `UPLOAD_PARTIAL` | ERROR | True | 부분 저장 (일부 rows만 성공) |
| `STORAGE_BUCKET_MISSING` | WARN | - | md-backups 버킷 없음 (백업 스킵) |
| `STORAGE_UPLOAD_FAILED` | WARN | - | Storage 업로드 실패 (메인 DB는 성공) |

---

## 6. 환경 변수 및 설정

### 6.1 파이프라인 환경 변수 (`.env`)

```bash
# === Supabase (필수) ===
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # 절대 클라이언트 노출 금지

# === 경로 설정 (선택, 기본값 있음) ===
INPUTS_DIR=./inputs
PROCESSED_DIR=./processed
QUARANTINE_DIR=./quarantine
STATE_DIR=./state

# === 파이프라인 파라미터 (선택) ===
MAX_FILE_SIZE_MB=5           # 스캔 상한 (기본: 5)
MIN_FILE_SIZE_BYTES=10       # 스캔 하한 (기본: 10)
UPLOAD_RETRY_MAX=3           # 재시도 횟수 (기본: 3)
UPLOAD_RETRY_MIN_WAIT=2      # 최소 대기 초 (기본: 2)
UPLOAD_RETRY_MAX_WAIT=8      # 최대 대기 초 (기본: 8)

# === 로깅 ===
LOG_LEVEL=INFO               # DEBUG | INFO | WARN | ERROR
LOG_TO_FILE=false            # true면 ./state/pipeline.log 생성
```

### 6.2 Next.js 환경 변수 (`.env.local` / Vercel)

```bash
# === Supabase (공개 가능 — anon key) ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...  # 읽기 전용

# === 앱 설정 ===
NEXT_PUBLIC_APP_NAME="AIX Knowledge Slides"
NEXT_PUBLIC_SLIDES_PER_PAGE=20        # 홈 화면 페이지네이션
NEXT_PUBLIC_SEARCH_INDEX_CACHE_TTL=300 # 초 단위 (기본: 5분)
```

---

## 7. Next.js 프론트엔드 아키텍처

### 7.1 디렉토리 구조

```
/frontend
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx                # 루트 레이아웃 (폰트, 메타)
│   ├── page.tsx                  # 홈 (과목 목록)
│   ├── course/
│   │   └── [courseId]/
│   │       └── page.tsx          # 슬라이드 뷰어
│   ├── search/
│   │   └── page.tsx              # 검색 결과
│   └── api/
│       ├── courses/route.ts      # GET /api/courses
│       ├── slides/[courseId]/route.ts  # GET /api/slides/[courseId]
│       └── search-index/route.ts # GET /api/search-index
│
├── components/
│   ├── slides/
│   │   ├── SlideViewer.tsx       # 메인 뷰어 컨테이너
│   │   ├── SlideRenderer.tsx     # 레이아웃별 슬라이드 렌더
│   │   ├── ProgressBar.tsx       # 진행률 바
│   │   ├── SlideControls.tsx     # ← → 버튼 + 카운터
│   │   ├── NotesPanel.tsx        # 발표자 노트 토글
│   │   └── blocks/
│   │       ├── CodeBlock.tsx     # Shiki 코드 하이라이팅
│   │       ├── ListBlock.tsx     # 애니메이션 리스트
│   │       ├── ImageBlock.tsx    # 이미지 + alt
│   │       └── TableBlock.tsx    # 테이블
│   ├── home/
│   │   ├── CourseCard.tsx        # 과목 카드
│   │   ├── TagFilter.tsx         # 태그 chip 필터
│   │   ├── LevelFilter.tsx       # 레벨 토글
│   │   └── SearchBar.tsx         # 퍼지 검색 입력
│   └── common/
│       ├── Badge.tsx             # 레벨/태그 배지
│       └── Skeleton.tsx          # 로딩 스켈레톤
│
├── hooks/
│   ├── useSlideNavigation.ts     # 키보드/스와이프 이벤트
│   ├── useSlides.ts              # SWR 기반 슬라이드 fetch
│   └── useFuzzySearch.ts         # Fuse.js 래퍼
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # createBrowserClient (anon key)
│   │   └── server.ts             # createServerClient (서버 컴포넌트용)
│   └── search/
│       └── buildIndex.ts         # Fuse.js 인덱스 빌더
│
└── types/
    ├── slide.ts                  # SlideData, ParsedDocument 타입
    ├── course.ts                 # Course 타입
    └── supabase.ts               # DB 자동 생성 타입 (supabase gen types)
```

### 7.2 상태 관리 전략

- **서버 컴포넌트**: 코스 목록, 초기 슬라이드 데이터 (SSR, 캐싱)
- **클라이언트 컴포넌트**: 슬라이드 탐색 상태, 검색 필터, 노트 토글
- **URL 상태**: 현재 슬라이드 인덱스 (`?slide=N`), 활성 태그 (`?tags=python,basics`)
- **캐싱**: SWR `revalidateOnFocus: false`, `dedupingInterval: 300000`

---

## 8. API Fetch 명세 (Frontend ↔ Supabase)

### 8.1 GET /api/courses — 과목 목록

**목적**: 홈 화면 과목 카드 목록

**Supabase 쿼리** (서버 컴포넌트):
```typescript
const { data, error } = await supabase
  .from('courses')
  .select(`
    course_id,
    title,
    level,
    total_slides,
    total_duration,
    thumbnail_url,
    course_tags (
      tags ( name, slug )
    )
  `)
  .eq('is_published', true)
  .order('created_at', { ascending: false });
```

**응답 형식**:
```json
{
  "data": [
    {
      "course_id": "python-101",
      "title": "파이썬 기초",
      "level": "beginner",
      "total_slides": 24,
      "total_duration": 60,
      "thumbnail_url": null,
      "tags": [
        {"name": "Python", "slug": "python"},
        {"name": "기초", "slug": "basics"}
      ]
    }
  ],
  "count": 5
}
```

**캐싱**: `revalidate: 300` (5분)

---

### 8.2 GET /api/slides/[courseId] — 슬라이드 목록

**목적**: 슬라이드 뷰어 초기 로드

**Supabase 쿼리** (서버 컴포넌트):
```typescript
const { data, error } = await supabase
  .from('knowledge_slides')
  .select(`
    id,
    slide_index,
    title,
    layout,
    content_json,
    tags
  `)
  .eq('course_id', courseId)
  .eq('is_searchable', true)
  .order('slide_index', { ascending: true });
```

**응답 형식**:
```json
{
  "course": {
    "course_id": "python-101",
    "title": "파이썬 기초",
    "level": "beginner",
    "total_slides": 6,
    "total_duration": 30
  },
  "slides": [
    {
      "id": "uuid-1",
      "slide_index": 0,
      "title": "변수와 자료형",
      "layout": "default",
      "content_json": {
        "layout": "default",
        "blocks": [...],
        "notes": "발표자 노트 내용",
        "meta": {...}
      },
      "tags": ["python", "basics"]
    }
  ]
}
```

**캐싱**: `revalidate: 60` (1분)  
**에러 처리**: courseId 없을 시 404 반환

---

### 8.3 GET /api/search-index — 검색 인덱스

**목적**: 클라이언트사이드 Fuse.js 인덱스 초기화

**Supabase 쿼리** (서버 컴포넌트):
```typescript
const { data, error } = await supabase
  .from('knowledge_slides')
  .select(`
    id,
    slide_index,
    course_id,
    title,
    layout,
    tags
  `)
  .eq('is_searchable', true)
  .not('title', 'is', null);
```

**응답 형식** (경량화):
```json
{
  "index": [
    {
      "id": "uuid-1",
      "courseId": "python-101",
      "slideIndex": 0,
      "title": "변수와 자료형",
      "tags": ["python", "basics"]
    }
  ],
  "generated_at": "2026-04-20T14:00:00Z"
}
```

**캐싱**: `revalidate: 300` (5분)

---

### 8.4 GET /api/tags — 태그 목록 (필터용)

**Supabase 쿼리**:
```typescript
const { data } = await supabase
  .from('tags')
  .select('name, slug, usage_count')
  .gt('usage_count', 0)
  .order('usage_count', { ascending: false })
  .limit(50);
```

**응답**:
```json
{
  "tags": [
    {"name": "Python", "slug": "python", "usage_count": 12},
    {"name": "기초", "slug": "basics", "usage_count": 8}
  ]
}
```

---

### 8.5 클라이언트사이드 검색 구현 (Fuse.js)

```typescript
// lib/search/buildIndex.ts
import Fuse from 'fuse.js';

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'courseId', weight: 0.2 },
  ],
  threshold: 0.4,           // 유사도 임계값 (0=정확, 1=모두 매칭)
  includeMatches: true,     // 매칭 위치 반환 (하이라이팅용)
  minMatchCharLength: 2,    // 최소 검색어 길이
};

export function buildSearchIndex(indexData: SearchIndexItem[]) {
  return new Fuse(indexData, FUSE_OPTIONS);
}
```

**검색 결과 형식**:
```typescript
interface SearchResult {
  item: {
    id: string;
    courseId: string;
    slideIndex: number;
    title: string;
    tags: string[];
  };
  matches: Array<{
    key: string;
    indices: [number, number][];
  }>;
  score: number;  // 0에 가까울수록 높은 유사도
}
```

---

### 8.6 URL 상태 관리 (슬라이드 뷰어)

```typescript
// 현재 슬라이드 URL 동기화
// /course/python-101?slide=3

const router = useRouter();
const searchParams = useSearchParams();
const currentSlide = Number(searchParams.get('slide')) || 0;

function navigateTo(index: number) {
  router.push(`/course/${courseId}?slide=${index}`, { scroll: false });
}
```

---

## 9. 파일 시스템 구조

### 9.1 파이프라인 (최종 구현 예상)

```
/project-root
├── CLAUDE.md
├── PRD.md                           ← 이 문서
├── Technical_Spec.md                ← 이 문서
├── run.py                           ← 진입점
├── requirements.txt
├── .env                             ← gitignore
├── .env.example
│
├── /agents
│   ├── pipeline_commander.md
│   ├── scanner_agent.md
│   ├── parser_agent.md
│   ├── validator_agent.md
│   ├── repair_agent.md
│   ├── uploader_agent.md
│   └── evaluator_agent.md
│
├── /pipeline                        ← Python 구현 (구현 단계에서 생성)
│   ├── __init__.py
│   ├── commander.py                 ← Orchestrator
│   ├── scanner.py
│   ├── parser.py
│   ├── validator.py
│   ├── repair.py
│   ├── uploader.py
│   ├── evaluator.py
│   └── models.py                    ← 공유 dataclass 정의
│
├── /schemas
│   ├── slide_schema.json            ← JSON Schema
│   └── slide_schema.sql             ← DB DDL (신규)
│
├── /inputs                          ← .md 투입 폴더
├── /processed                       ← 완료 파일
├── /quarantine                      ← 격리 파일
│   └── {stem}_report.json          ← 격리 리포트
│
├── /state
│   ├── pipeline_state.json
│   ├── dead_letter.json
│   └── run_report_{run_id}.json
│
├── /reference                       ← 기술 참조 문서
│
└── /frontend                        ← Next.js App (별도 단계)
    ├── package.json
    ├── next.config.ts
    └── ...
```

---

## 10. 의존성 목록

### 10.1 Python 파이프라인

```txt
# requirements.txt
python-frontmatter==1.1.0     # YAML frontmatter 파싱
mistune==3.0.2                # Markdown → AST 파싱
supabase==2.x.x               # Supabase Python SDK
tenacity==8.x.x               # 재시도 로직
python-dotenv==1.0.x          # .env 로드
chardet==5.x.x                # 인코딩 자동 감지
jsonschema==4.x.x             # JSON Schema 검증
```

### 10.2 Next.js 프론트엔드

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "fuse.js": "^7.x",
    "shiki": "^1.x",
    "framer-motion": "^11.x",
    "swr": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "@types/react": "^18.x"
  }
}
```

---

## 11. 구현 순서 가이드

### Session 1 — 파이프라인 코어
1. `pipeline/models.py` — 공유 dataclass 정의
2. `pipeline/scanner.py` — FileQueue 생성
3. `pipeline/parser.py` — ParsedDocument 변환
4. 단위 테스트: `tests/test_scanner.py`, `tests/test_parser.py`

### Session 2 — 검증 및 복구
5. `pipeline/validator.py` — JSON Schema + 비즈니스 규칙
6. `pipeline/repair.py` — 복구 전략 카탈로그 구현
7. 통합 테스트: 오류 파일 시나리오 검증

### Session 3 — DB 연동
8. Supabase 테이블 생성 (`/schemas/slide_schema.sql` 실행)
9. `pipeline/uploader.py` — upsert + Storage 백업
10. `pipeline/evaluator.py` — 무결성 검증

### Session 4 — Orchestrator + 종단 테스트
11. `pipeline/commander.py` — 상태 기계 구현
12. `run.py` — 진입점 연결
13. 종단 테스트: `/inputs`에 샘플 .md 투입 후 `python run.py`

### Session 5 — 프론트엔드 기본
14. Next.js 프로젝트 초기화 + Supabase 클라이언트 설정
15. 홈 화면 (과목 카드 목록)
16. 슬라이드 뷰어 기본 (키보드 탐색 + Progress Bar)

### Session 6 — 프론트엔드 고도화
17. 코드 블록 Syntax Highlight (Shiki)
18. 태그 필터 + Fuse.js 검색
19. 반응형 레이아웃 + 모바일 스와이프
20. Vercel 배포

---

*Claude는 완벽하지 않습니다. 이 명세서의 설계 결정은 구현 전 반드시 검토하세요.*
