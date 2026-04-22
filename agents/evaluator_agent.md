# evaluator_agent

## 단일 책임
uploader_agent 완료 후 DB 실제 저장 상태를 SELECT로 재확인하여 무결성을 검증한다.
통과 시 .md 파일을 `/processed`로 이동하고, 최종 리포트를 기록한다.

## 입력
```python
upload_result: UploadResult   # uploader_agent 출력
file_info: MdFileInfo         # 원본 파일 (이동 처리용)
```

## 출력
```python
@dataclass
class EvaluationReport:
    source_file: str
    match: bool                      # 파싱 수 == DB 저장 수
    expected_count: int
    actual_db_count: int
    missing_slide_indices: list[int] # 누락된 슬라이드 인덱스
    disposition: str                 # "processed" | "retry" | "manual_review"
    evaluated_at: str                # ISO8601
```

## 처리 로직

### Step 1: DB 재조회 (SELECT)
```python
response = (
    supabase.table("knowledge_slides")
    .select("id, slide_index", count="exact")
    .eq("source_file", upload_result.source_file)
    .execute()
)

actual_db_count = response.count
db_indices = {row["slide_index"] for row in response.data}
```

### Step 2: 무결성 비교
```python
expected_indices = set(range(upload_result.expected_count))
missing = expected_indices - db_indices

if not missing:
    # 완전 일치 → /processed 이동
    report.match = True
    report.disposition = "processed"
else:
    # 누락 존재 → pipeline_commander에 재업로드 요청
    report.match = False
    report.missing_slide_indices = sorted(missing)
    report.disposition = "retry"
```

### Step 3: /processed 이동 (match=True인 경우만)
```python
import shutil
dest = PROCESSED_FOLDER / file_info.name
shutil.move(str(file_info.path), str(dest))
# 이동 확인: dest.exists() 검사
```

### Step 4: pipeline_log 테이블 기록
```python
supabase.table("pipeline_log").insert({
    "source_file": source_file,
    "course_id": upload_result.course_id,
    "slide_count": actual_db_count,
    "disposition": report.disposition,
    "raw_md_hash": upload_result.raw_md_hash,
    "processed_at": now(),
}).execute()
```

## 재업로드 요청 프로토콜
```python
# evaluator → pipeline_commander로 반환
if not report.match:
    # pipeline_commander가 uploader_agent.upload_missing() 호출
    # 누락된 slide_index만 선택적 재업로드
    missing_slides = [
        slide for slide in validated.slides
        if slide.index in report.missing_slide_indices
    ]
    # 1회 재시도 후에도 불일치 → disposition = "manual_review"
```

## 최종 파이프라인 요약 리포트
모든 파일 처리 완료 후 pipeline_commander가 evaluator에게 요청:

```python
summary = {
    "run_id": state.run_id,
    "started_at": state.started_at,
    "finished_at": now(),
    "duration_seconds": elapsed,
    "total_files": state.stats.total,
    "processed": state.stats.success,
    "quarantined": len(state.quarantined),
    "dead_letter": len(state.dead_letter),
    "total_slides_uploaded": sum(r.actual_count for r in results),
}
```

콘솔 및 `/state/run_report_{run_id}.json`에 저장.

## 콘솔 출력 예시
```
[evaluator] 01_파이썬기초.md 무결성 검증 중...
[evaluator]   예상: 6 slides, DB 실제: 6 slides → 일치 ✓
[evaluator]   /inputs/01_파이썬기초.md → /processed/01_파이썬기초.md 이동 완료
[evaluator]   pipeline_log 기록 완료

[evaluator] 최종 리포트
[evaluator] ═══════════════════════════════════
[evaluator]   처리 완료: 4/5 파일
[evaluator]   격리:      1 파일 (/quarantine/03_오류파일.md)
[evaluator]   업로드 슬라이드: 총 24개
[evaluator]   소요 시간: 12.3초
[evaluator] ═══════════════════════════════════
```
