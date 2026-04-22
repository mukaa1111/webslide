# parser_agent

## 단일 책임
`MdFileInfo`의 raw content를 받아 구조화된 `ParsedDocument` JSON으로 변환한다.
파싱 라이브러리: `python-frontmatter` (YAML 헤더) + `mistune` 3.x (본문 AST).

## 입력
```python
file_info: MdFileInfo  # scanner_agent 출력
```

## 출력
```python
@dataclass
class ParsedDocument:
    source_file: str          # "01_파이썬기초.md"
    meta: dict                # frontmatter YAML
    slides: list[SlideData]   # 슬라이드 배열
    raw_md_hash: str          # SHA256 (중복 감지용)
    error: ParseError | None  # 성공 시 None
    degraded: bool            # repair 후 최소화 복구된 경우

@dataclass
class SlideData:
    index: int                # 0부터 시작
    title: str | None
    layout: str               # "default" | "code-only" | "bullet-list" | "image-focus" | "title-only"
    blocks: list[dict]        # ContentBlock 배열
    notes: str | None         # <!-- notes --> 발표자 노트
```

## 처리 로직

### Step 1: Frontmatter 추출
```python
import frontmatter  # python-frontmatter 라이브러리
post = frontmatter.loads(file_info.content)
meta = post.metadata   # {"title": ..., "courseId": ..., "tags": [...]}
body = post.content    # frontmatter 제거된 순수 마크다운
```

### Step 2: 슬라이드 분리 전략

**우선순위 1** — `---` (ThematicBreak) 기준 분리
```
# 슬라이드 1 제목
내용...

---

# 슬라이드 2 제목
내용...
```

**우선순위 2 (폴백)** — `---` 없으면 `##` (H2) 기준 자동 분리
```python
# H2 헤딩마다 슬라이드 경계로 인식
# repair_agent가 이 폴백을 트리거함
```

### Step 3: 각 슬라이드 블록 파싱 (mistune 3.x)
```python
# 지원 블록 타입:
# paragraph, code, list(ordered/unordered),
# blockquote, table, image, heading, divider
```

### Step 4: 레이아웃 자동 감지
```python
def detect_layout(blocks) -> str:
    if only_one_code_block:    return "code-only"
    if has_image and few_blocks: return "image-focus"
    if has_list:               return "bullet-list"
    if no_blocks:              return "title-only"
    return "default"
```

### Step 5: raw_md_hash 생성
```python
import hashlib
raw_md_hash = hashlib.sha256(file_info.content.encode()).hexdigest()[:16]
# Supabase upsert의 변경 감지에 활용
```

## Frontmatter 규약 (필수/선택)

```yaml
---
# 필수
courseId: javascript-fundamentals    # 코스 식별자 (slug 형식)
title: "변수와 자료형"

# 선택 (없으면 파일명/기본값으로 채워짐)
order: 1
level: beginner          # beginner | intermediate | advanced
tags: [python, basics]
duration: 30             # 분 단위
author: "홍길동"
---
```

## 에러 처리

| 오류 유형 | ParseError 코드 | repair_agent 행동 |
|---|---|---|
| frontmatter YAML 문법 오류 | `FRONTMATTER_SYNTAX` | 기본 메타 자동 삽입 |
| frontmatter 없음 | `FRONTMATTER_MISSING` | 파일명 기반 메타 생성 |
| 슬라이드 0개 | `NO_SLIDES` | H2 기반 재분리 시도 |
| mistune 파싱 예외 | `PARSE_EXCEPTION` | 전체를 단일 슬라이드로 병합 |
| 인코딩 오류 | `ENCODING_ERROR` | scanner의 폴백 인코딩 재시도 |

## 콘솔 출력 예시
```
[parser] 01_파이썬기초.md 파싱 중...
[parser]   frontmatter: title="파이썬 기초", courseId="python-101"
[parser]   슬라이드 감지: --- 구분자 5개 → 6개 슬라이드
[parser]   레이아웃: default(3), code-only(2), bullet-list(1)
[parser] 완료 → ParsedDocument (6 slides)
```
