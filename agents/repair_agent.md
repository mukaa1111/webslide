# repair_agent

## 단일 책임
parser 또는 validator가 실패한 데이터를 받아 자동 복구를 시도한다.
**최대 2회** 복구 시도. 2회 모두 실패하면 `/quarantine`으로 격리한다.

## 입력
```python
@dataclass
class RepairRequest:
    attempt: int               # 1 또는 2
    source: str                # "parser" | "validator"
    file_info: MdFileInfo      # 원본 파일 정보
    data: ParsedDocument | ValidationResult  # 실패한 데이터
    errors: list               # 발생한 에러 목록
```

## 출력
```python
@dataclass
class RepairResult:
    success: bool
    data: ParsedDocument | None   # 성공 시 수정된 데이터
    applied_fixes: list[str]      # 적용된 수정 목록 (로그용)
    error: str | None             # 2회 실패 시 격리 사유
```

---

## 복구 전략 카탈로그

### Parser 실패 복구

#### FRONTMATTER_MISSING — frontmatter 없음
```python
# 1차: 파일명에서 메타 자동 생성
stem = "01_파이썬_기초"
→ meta = {
    "title": "파이썬 기초",
    "courseId": "auto-" + slugify(stem),
    "order": 1,      # 파일명 앞 숫자
    "_auto_generated": True  # degraded 플래그
  }
```

#### FRONTMATTER_SYNTAX — YAML 문법 오류
```python
# 1차: 공통 패턴 자동 수정
- 콜론 뒤 공백 없음: "title:제목" → "title: 제목"
- 따옴표 불일치: 정규식으로 감싸기
- 들여쓰기 오류: 재정렬 시도

# 2차: frontmatter 전체 제거 후 FRONTMATTER_MISSING 전략 적용
```

#### NO_SLIDES — 슬라이드 0개 (--- 구분자 없음)
```python
# 1차: H2(##) 헤딩 기준으로 자동 분리
sections = re.split(r'\n## ', body)
→ 각 섹션을 슬라이드 1개로 변환

# 2차: H1(#) 기준으로 분리 시도
# 그래도 없으면: 전체 본문을 단일 슬라이드로 병합 (degraded)
```

#### PARSE_EXCEPTION — mistune 예외
```python
# 1차: 특수 마크다운 문법 제거 후 재파싱
# (수식, 커스텀 directive 등 비표준 문법 strip)

# 2차: 본문 전체를 paragraph 단일 블록으로 강제 변환 (degraded)
→ SlideData(index=0, title=meta.title, layout="default",
            blocks=[{"type": "paragraph", "text": raw_body[:2000]}])
```

---

### Validator 실패 복구

#### MISSING_TITLE — title 없음
```python
# 1차: 첫 번째 슬라이드의 첫 번째 heading 블록에서 추출
# 없으면: 파일명(stem)에서 추출
meta["title"] = extract_first_heading(slides) or file_info.stem
```

#### INVALID_SLUG — courseId slug 형식 불일치
```python
# slugify 변환 (공백→하이픈, 한글 유지 또는 transliterate)
meta["courseId"] = re.sub(r'[^\w가-힣-]', '', courseId.lower()).replace(' ', '-')
```

#### NEGATIVE_DURATION — duration 음수
```python
meta["duration"] = abs(meta["duration"])
```

#### INVALID_LEVEL — level 범위 밖
```python
VALID_LEVELS = ["beginner", "intermediate", "advanced"]
if meta.get("level") not in VALID_LEVELS:
    meta["level"] = "beginner"  # 기본값
```

#### DUPLICATE_SLIDE_INDEX — 슬라이드 인덱스 중복
```python
# 인덱스 전체 재부여 (0, 1, 2, ...)
for i, slide in enumerate(slides):
    slide.index = i
```

---

## 격리 처리 (2회 모두 실패)

```python
def quarantine(file_info: MdFileInfo, reason: str):
    # 1. 파일을 /quarantine 으로 이동
    shutil.move(file_info.path, QUARANTINE_FOLDER / file_info.name)

    # 2. 격리 리포트 생성
    report = {
        "file": file_info.name,
        "quarantined_at": now(),
        "reason": reason,
        "attempt_1_fixes": [...],
        "attempt_2_fixes": [...],
        "recommendation": "수동 검토 필요"
    }
    write_json(QUARANTINE_FOLDER / f"{file_info.stem}_report.json", report)

    # 3. pipeline_state.json 업데이트
    state.quarantined.append(file_info.name)
```

## 복구 원칙
1. **비파괴적**: 원본 파일은 절대 수정하지 않는다. 메모리 상의 데이터만 수정.
2. **투명성**: 적용된 모든 수정을 `applied_fixes`에 기록한다.
3. **보수적**: 2차 시도는 1차보다 더 단순한 "최소 유효 데이터" 생성 전략 사용.
4. **격리 확실성**: 2회 모두 실패하면 반드시 `/quarantine` 이동 + 리포트 생성.

## 콘솔 출력 예시
```
[repair] 01_파이썬기초.md 복구 시도 #1 (source: parser, error: NO_SLIDES)
[repair]   적용: H2 헤딩 기준 자동 슬라이드 분리 → 4개 슬라이드 생성
[repair]   결과: 성공 (degraded=False)

[repair] 02_심화내용.md 복구 시도 #1 (source: validator, error: INVALID_SLUG)
[repair]   적용: courseId "Python 101" → "python-101" slugify 변환
[repair]   결과: 성공

[repair] 03_오류파일.md 복구 시도 #2 (source: parser, error: PARSE_EXCEPTION)
[repair]   적용: 전체 본문 → 단일 슬라이드 병합 (degraded)
[repair]   결과: 실패 → /quarantine 이동
[repair]   격리 리포트: /quarantine/03_오류파일_report.json
```
