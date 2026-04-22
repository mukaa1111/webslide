# uploader_agent

## 단일 책임
검증된 `ParsedDocument`를 Supabase `knowledge_slides` 테이블에 upsert한다.
원본 .md 파일을 Supabase Storage에 백업 업로드한다.
`tenacity` 라이브러리로 네트워크 실패 시 자동 재시도(최대 3회)한다.

## 입력
```python
validated: ParsedDocument   # validator_agent 통과 데이터
file_info: MdFileInfo       # 원본 파일 (Storage 업로드용)
```

## 출력
```python
@dataclass
class UploadResult:
    success: bool
    source_file: str
    uploaded_slide_ids: list[str]   # 업로드된 Supabase row ID 목록
    expected_count: int             # 파싱된 슬라이드 수
    actual_count: int               # DB에 실제 저장된 수
    storage_path: str | None        # 원본 .md 업로드 경로
    fatal: bool                     # True면 파이프라인 즉시 중단
    error: str | None
```

## Supabase 테이블 스키마

```sql
-- /schemas/slide_schema.sql 참조
CREATE TABLE knowledge_slides (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_file   TEXT NOT NULL,        -- "01_파이썬기초.md"
    slide_index   INTEGER NOT NULL,     -- 0부터 시작
    course_id     TEXT NOT NULL,        -- meta.courseId
    title         TEXT,                 -- slide.title
    content_json  JSONB NOT NULL,       -- SlideData 전체
    tags          TEXT[] DEFAULT '{}',  -- meta.tags
    raw_md_hash   TEXT,                 -- 변경 감지용 SHA256
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_file, slide_index)   -- 멱등성 보장
);
```

## 처리 로직

### Step 1: 슬라이드 배열 → DB rows 변환
```python
rows = [
    {
        "source_file": validated.source_file,
        "slide_index": slide.index,
        "course_id": validated.meta["courseId"],
        "title": slide.title,
        "content_json": {
            "layout": slide.layout,
            "blocks": slide.blocks,
            "notes": slide.notes,
            "meta": validated.meta,
        },
        "tags": validated.meta.get("tags", []),
        "raw_md_hash": validated.raw_md_hash,
    }
    for slide in validated.slides
]
```

### Step 2: Supabase upsert (tenacity 재시도)
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True
)
def _upsert_with_retry(supabase, rows):
    response = (
        supabase.table("knowledge_slides")
        .upsert(rows, on_conflict="source_file,slide_index")
        .execute()
    )
    return response

# 재시도 간격: 2초 → 4초 → 8초
```

### Step 3: Storage 백업 업로드
```python
# /md-backups/{courseId}/{source_file} 경로에 업로드
storage_path = f"{course_id}/{file_info.name}"
supabase.storage.from_("md-backups").upload(
    path=storage_path,
    file=file_info.content.encode("utf-8"),
    file_options={"upsert": True, "content-type": "text/markdown"}
)
```

### Step 4: 실패 분류
```python
except APIError as e:
    if e.code in ("PGRST301", "42501"):   # 인증/권한 오류
        result.fatal = True               # 재시도 불가 → 파이프라인 중단
    else:
        result.fatal = False              # tenacity 재시도 가능

except RetryError:
    result.fatal = True  # 3회 모두 소진 → DEAD_LETTER
```

## 환경 변수 요구사항

```bash
# .env (로컬 실행용)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# ※ Service Role Key 사용 (RLS 우회, 파이프라인 전용)
# 절대 클라이언트 사이드에 노출 금지
```

## 멱등성 보장
- `UNIQUE (source_file, slide_index)` 제약으로 동일 파일 재실행 시 INSERT 대신 UPDATE.
- `raw_md_hash`가 동일하면 `updated_at`만 변경 (변경 없음 감지 가능).

## DEAD_LETTER 처리
```python
# 3회 재시도 후 fatal=True인 경우
{
    "file": source_file,
    "failed_at": now(),
    "error": str(last_error),
    "rows_attempted": len(rows)
}
# → /state/dead_letter.json에 기록
# → pipeline_commander가 전체 파이프라인 중단
```

## 콘솔 출력 예시
```
[uploader] 01_파이썬기초.md → Supabase 업로드 시작 (6 slides)
[uploader]   upsert 시도 #1...
[uploader]   upsert 성공 → 6 rows (new: 6, updated: 0)
[uploader]   Storage 백업: md-backups/python-101/01_파이썬기초.md ✓
[uploader] 완료 → UploadResult(uploaded=6, expected=6)
```
