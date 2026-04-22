# Supabase Python SDK (`supabase-py`) 기술 레퍼런스
## 교육 콘텐츠 저장 파이프라인 완전 가이드 (v2.x 기준)

---

## 목차

1. [설치 및 환경 설정](#1-설치-및-환경-설정)
2. [클라이언트 초기화](#2-클라이언트-초기화)
3. [CRUD 작업: 슬라이드 JSON 데이터 삽입](#3-crud-작업-슬라이드-json-데이터-삽입)
4. [Upsert 패턴: 멱등성 파이프라인 구현](#4-upsert-패턴-멱등성-파이프라인-구현)
5. [배치 삽입: 단일 .md 파일의 다수 슬라이드 처리](#5-배치-삽입-단일-md-파일의-다수-슬라이드-처리)
6. [Storage SDK: 원본 .md 파일 업로드](#6-storage-sdk-원본-md-파일-업로드)
7. [Service Role vs Anon Key 사용 기준](#7-service-role-vs-anon-key-사용-기준)
8. [에러 핸들링 및 재시도 패턴](#8-에러-핸들링-및-재시도-패턴)
9. [비동기 지원: asyncio 활용](#9-비동기-지원-asyncio-활용)
10. [환경 변수 관리: python-dotenv](#10-환경-변수-관리-python-dotenv)
11. [실전 파이프라인: .md 읽기 → JSON 파싱 → Supabase upsert](#11-실전-파이프라인-md-읽기--json-파싱--supabase-upsert)
12. [Reveal.js 연동 개요](#12-revealjs-연동-개요)
13. [Next.js 슬라이드 UI 연동 개요](#13-nextjs-슬라이드-ui-연동-개요)

---

## 1. 설치 및 환경 설정

### 1.1 패키지 설치

```bash
# 기본 설치 (최신 v2.x)
pip install supabase

# 파이프라인 전용 의존성 일괄 설치
pip install supabase python-dotenv tenacity

# 버전 고정 (재현 가능한 환경)
pip install "supabase>=2.10.0,<3.0.0" python-dotenv tenacity
```

### 1.2 requirements.txt

```text
supabase>=2.10.0,<3.0.0
python-dotenv>=1.0.0
tenacity>=8.2.0
```

### 1.3 Supabase 테이블 DDL

```sql
-- 슬라이드 에셋 테이블
CREATE TABLE knowledge_slides (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_file   TEXT NOT NULL,
    slide_index   INTEGER NOT NULL,
    title         TEXT,
    content_json  JSONB NOT NULL,
    tags          TEXT[] DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_file, slide_index)   -- 멱등성 보장
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_slides_updated_at
    BEFORE UPDATE ON knowledge_slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage 버킷 (원본 .md 파일 보관)
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-assets', 'knowledge-assets', false)
ON CONFLICT DO NOTHING;
```

---

## 2. 클라이언트 초기화

### 2.1 동기(Sync) 클라이언트 — 파이프라인 스크립트용

```python
import os
from supabase import create_client, Client
from supabase.client import ClientOptions
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    url: str = os.environ["SUPABASE_URL"]
    key: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    return create_client(
        url,
        key,
        options=ClientOptions(
            postgrest_client_timeout=30,
            storage_client_timeout=60,
            schema="public",
        )
    )

supabase: Client = get_supabase_client()
```

### 2.2 비동기(Async) 클라이언트

```python
import asyncio
from supabase import acreate_client, AsyncClient

async def get_async_client() -> AsyncClient:
    return await acreate_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )
```

---

## 3. CRUD 작업: 슬라이드 JSON 데이터 삽입

### 3.1 단일 슬라이드 삽입

```python
def insert_slide(supabase: Client, slide_data: dict) -> dict:
    response = (
        supabase.table("knowledge_slides")
        .insert(slide_data)
        .execute()
    )
    return response.data[0]


# 사용 예시
slide = {
    "source_file": "chapter_01_intro.md",
    "slide_index": 0,
    "title": "강의 소개",
    "content_json": {
        "type": "title-slide",
        "heading": "강의 소개",
        "body": "이 강의에서는 Python 기초를 다룹니다.",
        "speaker_notes": "참가자 소개부터 시작합니다."
    },
    "tags": ["intro", "python", "beginner"]
}

result = insert_slide(supabase, slide)
print(f"삽입 완료: ID={result['id']}")
```

### 3.2 데이터 조회

```python
def get_slides_by_source(supabase: Client, source_file: str) -> list[dict]:
    response = (
        supabase.table("knowledge_slides")
        .select("id, slide_index, title, content_json, tags")
        .eq("source_file", source_file)
        .order("slide_index", desc=False)
        .execute()
    )
    return response.data


def get_slide_by_index(
    supabase: Client, source_file: str, slide_index: int
) -> dict | None:
    response = (
        supabase.table("knowledge_slides")
        .select("*")
        .eq("source_file", source_file)
        .eq("slide_index", slide_index)
        .maybe_single()  # 없으면 None
        .execute()
    )
    return response.data
```

---

## 4. Upsert 패턴: 멱등성 파이프라인 구현

파이프라인을 여러 번 재실행해도 데이터가 중복 생성되지 않도록 `upsert()`를 사용합니다.

### 4.1 복합 유니크 컬럼 기반 Upsert (권장)

```python
def upsert_slide(supabase: Client, slide_data: dict) -> dict:
    """
    source_file + slide_index 복합 유니크 키 기준 upsert.
    - 없으면: INSERT
    - 있으면: UPDATE
    """
    response = (
        supabase.table("knowledge_slides")
        .upsert(
            slide_data,
            on_conflict="source_file,slide_index",  # 쉼표로 복합 키 지정
        )
        .execute()
    )
    return response.data[0]
```

### 4.2 충돌 시 무시 (기존 데이터 보존)

```python
def insert_if_not_exists(supabase: Client, slide_data: dict) -> dict | None:
    response = (
        supabase.table("knowledge_slides")
        .upsert(
            slide_data,
            on_conflict="source_file,slide_index",
            ignore_duplicates=True,     # 충돌 시 기존 행 유지
        )
        .execute()
    )
    return response.data[0] if response.data else None
```

---

## 5. 배치 삽입: 단일 .md 파일의 다수 슬라이드 처리

```python
def upsert_slides_batch(
    supabase: Client,
    slides: list[dict],
    chunk_size: int = 100
) -> list[dict]:
    """
    다수의 슬라이드를 chunk_size 단위로 나누어 배치 upsert합니다.
    PostgREST 페이로드 한도를 회피하고 네트워크 왕복을 최소화합니다.
    """
    all_results: list[dict] = []

    for i in range(0, len(slides), chunk_size):
        chunk = slides[i : i + chunk_size]
        response = (
            supabase.table("knowledge_slides")
            .upsert(chunk, on_conflict="source_file,slide_index")
            .execute()
        )
        all_results.extend(response.data)
        print(f"  배치: {i+1}~{i+len(chunk)} / {len(slides)} 완료")

    return all_results
```

---

## 6. Storage SDK: 원본 .md 파일 업로드

### 6.1 파일 업로드

```python
def upload_markdown_file(
    supabase: Client,
    local_path: str,
    bucket_name: str = "knowledge-assets",
    storage_path: str | None = None,
) -> str:
    """
    로컬 .md 파일을 Supabase Storage에 업로드합니다.
    Returns: Storage 내 파일 경로
    """
    import os
    filename = os.path.basename(local_path)
    dest_path = storage_path or f"markdown/{filename}"

    with open(local_path, "rb") as f:
        supabase.storage.from_(bucket_name).upload(
            path=dest_path,
            file=f,
            file_options={
                "content-type": "text/markdown; charset=utf-8",
                "cache-control": "3600",
                "upsert": "true",   # 동일 경로 덮어쓰기
            }
        )

    return dest_path
```

### 6.2 서명된 URL 생성 (Private 버킷)

```python
def get_signed_url(
    supabase: Client,
    bucket_name: str,
    storage_path: str,
    expires_in: int = 3600
) -> str:
    """임시 서명된 URL 생성 (기본 1시간 유효)."""
    response = (
        supabase.storage
        .from_(bucket_name)
        .create_signed_url(storage_path, expires_in)
    )
    return response["signedURL"]
```

---

## 7. Service Role vs Anon Key 사용 기준

| 구분 | Anon Key | Service Role Key |
|------|----------|-----------------|
| RLS 적용 | 적용됨 | 완전히 우회 |
| 노출 허용 | 브라우저/프론트엔드 허용 | 절대 노출 금지 |
| 적합한 곳 | Next.js 클라이언트 컴포넌트 | **Python 파이프라인, Edge Function** |

```bash
# .env (반드시 .gitignore에 추가)
SUPABASE_URL=https://xyzxyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 파이프라인 전용

# Next.js 클라이언트용
NEXT_PUBLIC_SUPABASE_URL=https://xyzxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 8. 에러 핸들링 및 재시도 패턴

### 8.1 기본 예외 처리

```python
def safe_upsert_slide(supabase: Client, slide_data: dict) -> dict | None:
    try:
        response = (
            supabase.table("knowledge_slides")
            .upsert(slide_data, on_conflict="source_file,slide_index")
            .execute()
        )
        return response.data[0] if response.data else None

    except Exception as e:
        error_msg = str(e)
        if "unique constraint" in error_msg.lower():
            print(f"[WARN] 유니크 제약 위반: slide_index={slide_data.get('slide_index')}")
        elif "timeout" in error_msg.lower():
            raise  # 재시도 가능한 에러는 상위로 전파
        else:
            print(f"[ERROR] {error_msg}")
            raise
        return None
```

### 8.2 Tenacity 지수 백오프 재시도

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),  # 2s → 4s → 8s → 30s
    reraise=True,
)
def upsert_with_retry(supabase: Client, slide_data: dict) -> dict:
    response = (
        supabase.table("knowledge_slides")
        .upsert(slide_data, on_conflict="source_file,slide_index")
        .execute()
    )
    return response.data[0]
```

### 8.3 부분 실패 처리

```python
from dataclasses import dataclass, field

@dataclass
class BatchResult:
    succeeded: list[dict] = field(default_factory=list)
    failed: list[dict] = field(default_factory=list)


def upsert_slides_with_fallback(supabase: Client, slides: list[dict]) -> BatchResult:
    result = BatchResult()

    # 배치 전체 시도
    try:
        response = (
            supabase.table("knowledge_slides")
            .upsert(slides, on_conflict="source_file,slide_index")
            .execute()
        )
        result.succeeded.extend(response.data)
        return result
    except Exception as batch_error:
        print(f"[WARN] 배치 실패, 개별 처리로 폴백: {batch_error}")

    # 개별 폴백
    for slide in slides:
        try:
            row = upsert_with_retry(supabase, slide)
            result.succeeded.append(row)
        except Exception as e:
            result.failed.append(slide)
            print(f"[ERROR] slide_index={slide.get('slide_index')}: {e}")

    return result
```

---

## 9. 비동기 지원: asyncio 활용

```python
import asyncio
from supabase import acreate_client, AsyncClient

async def async_upsert_slides_concurrent(
    supabase: AsyncClient,
    slides: list[dict],
    max_concurrent: int = 10,
) -> list[dict]:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def upsert_one(slide: dict) -> dict:
        async with semaphore:
            response = await (
                supabase.table("knowledge_slides")
                .upsert(slide, on_conflict="source_file,slide_index")
                .execute()
            )
            return response.data[0]

    tasks = [upsert_one(slide) for slide in slides]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if not isinstance(r, Exception)]
    print(f"동시 처리 완료: {len(successes)}/{len(slides)} 성공")
    return successes
```

---

## 10. 환경 변수 관리: python-dotenv

### 10.1 설정 모듈

```python
# config.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class PipelineConfig:
    supabase_url: str
    supabase_service_role_key: str
    storage_bucket: str
    md_source_dir: str
    batch_size: int
    max_retry: int

    @classmethod
    def from_env(cls) -> "PipelineConfig":
        missing = [k for k in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
                   if not os.environ.get(k)]
        if missing:
            raise EnvironmentError(f"필수 환경 변수 누락: {', '.join(missing)}")

        return cls(
            supabase_url=os.environ["SUPABASE_URL"],
            supabase_service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            storage_bucket=os.environ.get("PIPELINE_STORAGE_BUCKET", "knowledge-assets"),
            md_source_dir=os.environ.get("PIPELINE_MD_SOURCE_DIR", "./inputs"),
            batch_size=int(os.environ.get("PIPELINE_BATCH_SIZE", "50")),
            max_retry=int(os.environ.get("PIPELINE_MAX_RETRY", "4")),
        )


config = PipelineConfig.from_env()
```

---

## 11. 실전 파이프라인: .md 읽기 → JSON 파싱 → Supabase upsert

### 11.1 .md 파서

```python
# md_parser.py
import re
from pathlib import Path


def parse_slides_from_md(md_file_path: str) -> list[dict]:
    """
    .md 파일을 --- 구분자 기준으로 분할하여 슬라이드 목록 반환.
    """
    path = Path(md_file_path)
    raw = path.read_text(encoding="utf-8")
    source_file = path.name

    sections = [s.strip() for s in re.split(r"\n---\n", raw) if s.strip()]

    return [_parse_section(section, source_file, idx)
            for idx, section in enumerate(sections)]


def _parse_section(section: str, source_file: str, idx: int) -> dict:
    lines = section.split("\n")
    title = None
    body_lines = []
    speaker_notes = ""
    in_notes = False

    for line in lines:
        if title is None and re.match(r"^#{1,3}\s+", line):
            title = re.sub(r"^#{1,3}\s+", "", line).strip()
        elif re.match(r"^Note:\s*", line, re.IGNORECASE):
            in_notes = True
            speaker_notes = re.sub(r"^Note:\s*", "", line, flags=re.IGNORECASE).strip()
        elif in_notes:
            speaker_notes += "\n" + line
        else:
            body_lines.append(line)

    body = "\n".join(body_lines).strip()

    return {
        "source_file": source_file,
        "slide_index": idx,
        "title": title or f"슬라이드 {idx + 1}",
        "content_json": {
            "heading": title or f"슬라이드 {idx + 1}",
            "body": body,
            "speaker_notes": speaker_notes.strip(),
            "raw_markdown": section,
        },
        "tags": _extract_tags(section),
    }


def _extract_tags(section: str) -> list[str]:
    match = re.search(r"<!--\s*tags:\s*(.+?)\s*-->", section, re.IGNORECASE)
    if match:
        return [t.strip() for t in match.group(1).split(",") if t.strip()]
    return []
```

### 11.2 완전한 파이프라인 스크립트

```python
# pipeline.py
import logging
import sys
from pathlib import Path

from supabase import create_client, Client
from supabase.client import ClientOptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from config import config
from md_parser import parse_slides_from_md

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("knowledge-pipeline")


def build_client() -> Client:
    return create_client(
        config.supabase_url,
        config.supabase_service_role_key,
        options=ClientOptions(postgrest_client_timeout=30, storage_client_timeout=60),
    )


@retry(
    retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
    stop=stop_after_attempt(config.max_retry),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def _upsert_batch(supabase: Client, batch: list[dict]) -> list[dict]:
    return (
        supabase.table("knowledge_slides")
        .upsert(batch, on_conflict="source_file,slide_index")
        .execute()
    ).data


def run_pipeline(md_file_path: str) -> dict:
    """단일 .md 파일에 대한 전체 파이프라인 실행."""
    logger.info(f"===== 파이프라인 시작: {md_file_path} =====")
    supabase = build_client()

    # Step 1: Storage 업로드
    filename = Path(md_file_path).name
    storage_path = f"markdown/{filename}"
    logger.info(f"[Step 1] Storage 업로드: {filename}")
    with open(md_file_path, "rb") as f:
        supabase.storage.from_(config.storage_bucket).upload(
            path=storage_path, file=f,
            file_options={"content-type": "text/markdown; charset=utf-8", "upsert": "true"}
        )

    # Step 2: 파싱
    logger.info(f"[Step 2] 슬라이드 파싱")
    slides = parse_slides_from_md(md_file_path)
    logger.info(f"[Step 2] {len(slides)}개 슬라이드 추출")

    # Step 3: DB upsert (청크 단위)
    logger.info(f"[Step 3] DB upsert 시작")
    succeeded = []
    failed = []
    enriched = [{**s, "source_md_storage_path": storage_path} for s in slides]

    for i in range(0, len(enriched), config.batch_size):
        chunk = enriched[i : i + config.batch_size]
        try:
            rows = _upsert_batch(supabase, chunk)
            succeeded.extend(rows)
        except Exception as e:
            logger.error(f"청크 실패: {e}")
            failed.extend(chunk)

    summary = {"total": len(slides), "succeeded": len(succeeded), "failed": len(failed)}
    logger.info(f"===== 완료: {summary} =====")
    return summary


def run_pipeline_for_directory(source_dir: str) -> list[dict]:
    md_files = sorted(Path(source_dir).rglob("*.md"))
    if not md_files:
        logger.warning(f"처리할 파일 없음: {source_dir}")
        return []

    results = []
    for md_path in md_files:
        try:
            result = run_pipeline(str(md_path))
            results.append({"file": md_path.name, "status": "success", **result})
        except Exception as e:
            logger.error(f"실패: {md_path.name} — {e}")
            results.append({"file": md_path.name, "status": "error", "error": str(e)})

    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        results = run_pipeline_for_directory(config.md_source_dir)
    else:
        target = sys.argv[1]
        if Path(target).is_dir():
            results = run_pipeline_for_directory(target)
        else:
            results = [run_pipeline(target)]

    success = sum(1 for r in results if r.get("status") == "success")
    print(f"\n처리 완료: {success}/{len(results)} 파일 성공")
```

### 11.3 실행 방법

```bash
# 단일 파일
python pipeline.py ./inputs/chapter_01.md

# 디렉터리 전체 (/inputs 기본값)
python pipeline.py ./inputs/

# 환경 변수 오버라이드
PIPELINE_BATCH_SIZE=20 python pipeline.py ./inputs/
```

---

## 12. Reveal.js 연동 개요

Supabase에 저장된 `content_json`은 reveal.js 슬라이드 구조와 직접 매핑됩니다. Next.js API Route가 `knowledge_slides` 테이블에서 `source_file` 기준으로 슬라이드 목록을 조회하면, 프론트엔드는 JSON 배열로 `<section>` 태그 트리를 동적으로 생성합니다:

- `content_json.heading` → `<h2>`
- `content_json.body` → 마크다운→HTML 변환 후 `<div class="slide-body">`
- `content_json.speaker_notes` → `<aside class="notes">`

파이프라인이 콘텐츠를 업데이트하면 다음 브라우저 로드 시점에 자동으로 최신 슬라이드가 반영됩니다. `tags` 배열 쿼리로 특정 주제 슬라이드만 선별해 프레젠테이션을 구성하는 것도 가능합니다.

---

## 13. Next.js 슬라이드 UI 연동 개요

Next.js App Router Server Component는 `SUPABASE_SERVICE_ROLE_KEY`로 `knowledge_slides`를 직접 쿼리하고, 슬라이드 JSON 배열을 Client Component에 prop으로 전달합니다. 실시간 협업이 필요한 경우 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용하는 Realtime 구독을 Client Component에 추가해 DB 변경 즉시 슬라이드가 갱신되도록 구성할 수 있습니다.

Storage 원본 파일은 Next.js API Route(`/api/slides/[source_file]/download`)에서 `create_signed_url()`을 호출해 서명된 임시 URL로 제공합니다. 이 패턴은 Storage 버킷을 private으로 유지하면서 인증된 사용자에게만 선택적 접근 권한을 부여합니다.

---

## 부록: API 메서드 요약

| 목적 | 메서드 | 핵심 파라미터 |
|------|--------|--------------|
| 단일 삽입 | `.insert(dict)` | `returning`, `count` |
| 배치 삽입 | `.insert(list)` | `default_to_null` |
| Upsert | `.upsert(dict\|list)` | `on_conflict`, `ignore_duplicates` |
| 조회 | `.select("cols")` | `.eq()`, `.order()`, `.limit()` |
| 수정 | `.update(dict)` | 필터 체인 필수 |
| 삭제 | `.delete()` | 필터 체인 필수 |
| 파일 업로드 | `.storage.from_().upload()` | `file_options.upsert` |
| 서명된 URL | `.storage.from_().create_signed_url()` | `expires_in` (초) |

### 핵심 체크리스트

- `.env`를 `.gitignore`에 추가했는가?
- 파이프라인 스크립트는 `service_role` 키를 사용하는가?
- `UNIQUE (source_file, slide_index)` 제약이 테이블에 있는가?
- `upsert(on_conflict=...)` 컬럼명이 DB 제약과 일치하는가?
- Storage 버킷이 생성되어 있는가?
- 배치 크기(`chunk_size`)가 PostgREST 최대 페이로드(기본 1MB) 이내인가?

---

> 기준 버전: `supabase-py` v2.10.0+, Python 3.11+, `tenacity` 8.x, `python-dotenv` 1.x
