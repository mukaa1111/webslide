# validator_agent

## 단일 책임
`ParsedDocument`가 Supabase 업로드 전 품질 기준을 충족하는지 검증한다.
JSON Schema(`/schemas/slide_schema.json`) + 비즈니스 규칙 검사를 수행한다.

## 입력
```python
parsed: ParsedDocument  # parser_agent 또는 repair_agent 출력
```

## 출력
```python
@dataclass
class ValidationResult:
    ok: bool
    parsed: ParsedDocument       # 원본 또는 repair 후 데이터
    errors: list[ValidationError]
    warnings: list[str]

@dataclass
class ValidationError:
    code: str      # 에러 코드
    field: str     # 문제 필드 경로
    message: str
    fixable: bool  # repair_agent가 자동 수정 가능한 오류인가
```

## 검증 규칙

### Level 1: 필수 필드 (FATAL — fixable=False)
```
ParsedDocument.source_file  → 비어있지 않음
ParsedDocument.meta.courseId → 비어있지 않음
ParsedDocument.slides       → 배열, 1개 이상
```

### Level 2: 스키마 형식 (ERROR — fixable=True)
```
meta.title          → 문자열, 1~200자
meta.courseId       → slug 형식 (영소문자, 숫자, 하이픈만)
meta.order          → 양의 정수 (없으면 기본값 허용)
meta.duration       → 0 이상 정수 (없으면 기본값 허용)
meta.level          → "beginner" | "intermediate" | "advanced" (없으면 기본값 허용)
```

### Level 3: 슬라이드 품질 (WARN — fixable=True)
```
각 slide.index      → 0부터 중복 없이 순차
각 slide.blocks     → 배열 (빈 배열은 WARN만, 통과는 가능)
각 slide.layout     → 허용된 레이아웃 값
전체 slide 수       → 50개 초과 시 WARN (비정상적으로 큰 파일)
```

### Level 4: 비즈니스 규칙 (WARN)
```
meta.duration이 있는 경우 → slide 수와 비교 (슬라이드당 1분 미만이면 경고)
code 블록에 lang 없음      → WARN (프론트엔드 하이라이팅 불가)
image 블록에 alt 없음      → WARN (접근성)
```

## 검증 흐름

```python
errors = []
warnings = []

# Level 1: 즉시 실패
if not parsed.meta.get("courseId"):
    errors.append(ValidationError("MISSING_COURSE_ID", "meta.courseId", ..., fixable=False))
    return ValidationResult(ok=False, errors=errors)  # 여기서 중단

# Level 2 + 3: 모두 수집 후 판단
check_schema(parsed, errors, warnings)
check_slide_quality(parsed, errors, warnings)

fatal_errors = [e for e in errors if not e.fixable]
fixable_errors = [e for e in errors if e.fixable]

if fatal_errors:
    return ValidationResult(ok=False, errors=errors, ...)

if fixable_errors:
    # repair_agent에게 위임 (pipeline_commander가 결정)
    return ValidationResult(ok=False, errors=fixable_errors, ...)

return ValidationResult(ok=True, warnings=warnings, ...)
```

## 에러 코드 목록

| 코드 | fixable | 설명 |
|---|---|---|
| `MISSING_COURSE_ID` | False | courseId 없음 — 치명적 |
| `NO_SLIDES` | True | 슬라이드 배열 비어있음 |
| `INVALID_SLUG` | True | courseId에 특수문자 포함 |
| `NEGATIVE_DURATION` | True | duration이 음수 |
| `INVALID_LEVEL` | True | level 값이 허용 범위 밖 |
| `DUPLICATE_SLIDE_INDEX` | True | 슬라이드 인덱스 중복 |
| `TITLE_TOO_LONG` | True | title 200자 초과 |
| `MISSING_TITLE` | True | meta.title 없음 |

## 콘솔 출력 예시
```
[validator] ParsedDocument 검증 중 (6 slides)...
[validator]   WARN: slide[2].blocks[0].code에 lang 없음
[validator]   ERROR(fixable): meta.courseId = "Python 101" → slug 형식 불일치
[validator] 결과: FAIL (fixable 오류 1개) → repair_agent 요청
```
