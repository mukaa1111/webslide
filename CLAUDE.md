# AIX 파이프라인 헌법 (Pipeline Constitution)

## 디자인 시스템

**항상 참조**: [`design.md`](design.md) — Web Slide 프로젝트의 디자인 시스템 전체 명세.
HTML/CSS 작업 시 반드시 이 파일을 먼저 읽고 색상, 타이포그래피, 스페이싱, 컴포넌트 패턴을 준수할 것.

---


## 프로젝트 비전
VOD 콘텐츠(NotebookLM .md) → 인터랙티브 웹 슬라이드로 변환하는 AIX 솔루션.
`python run.py` 한 번 실행으로 `/inputs` 폴더를 전수 처리하고 Supabase에 업로드한다.

---

## 실행 모드
**MVP Batch Mode** — watchdog 없이, 실행 시점에 `/inputs`를 1회 전수 스캔 후 종료.

```
python run.py
  → scanner → parser → validator → [repair] → uploader → evaluator → 종료
```

---

## 폴더 구조 규약

```
/project-root
├── CLAUDE.md                  ← 이 파일 (파이프라인 헌법)
├── run.py                     ← 진입점 (Orchestrator 호출)
├── /inputs                    ← NotebookLM .md 투입 폴더 (넘버링: 01_제목.md)
├── /processed                 ← 완료된 .md 이동 (evaluator 승인 후)
├── /quarantine                ← 복구 2회 실패 파일 격리
├── /agents                    ← 에이전트 명세 및 구현
│   ├── pipeline_commander.md  ← Orchestrator 역할 정의
│   ├── scanner_agent.md
│   ├── parser_agent.md
│   ├── validator_agent.md
│   ├── repair_agent.md
│   ├── uploader_agent.md
│   └── evaluator_agent.md
├── /schemas
│   └── slide_schema.json      ← JSON Schema (validator 사용)
├── /state
│   └── pipeline_state.json    ← 파이프라인 상태 영속화
└── /frontend                  ← Next.js App (별도 단계)
```

---

## 에이전트 책임 매트릭스

| 에이전트 | 단일 책임 | 입력 | 출력 | 실패 시 |
|---|---|---|---|---|
| scanner | /inputs 스캔 + 큐 생성 | 폴더 경로 | `FileQueue[]` | 다음 파일 스킵 + WARN 로그 |
| parser | .md → ParsedDocument JSON | `MdFileInfo` | `ParsedDocument` | repair_agent 호출 |
| validator | JSON Schema 검증 | `ParsedDocument` | `ValidationResult` | repair_agent 호출 |
| repair | 자동 복구 (최대 2회) | 실패한 데이터 + 오류 유형 | 수정된 데이터 | 격리 + FATAL 리포트 |
| uploader | Supabase upsert | `ValidatedDocument` | `UploadResult` | tenacity 재시도 3회 |
| evaluator | DB 무결성 검증 + 완료 처리 | `UploadResult` | `EvaluationReport` | 부분 재업로드 요청 |

**규칙**: 에이전트 간 직접 호출 금지. 반드시 `pipeline_commander`(run.py Orchestrator) 경유.

---

## 파이프라인 상태 기계

```
IDLE
 │ run.py 실행
 ▼
SCANNING
 │ 성공: FileQueue 생성
 │ 실패: WARN 로그, 해당 파일 스킵
 ▼
PARSING
 │ 성공: ParsedDocument
 │ 실패 → REPAIRING (최대 2회)
 │         2회 실패 → QUARANTINE
 ▼
VALIDATING
 │ 성공: ValidatedDocument
 │ 실패 → REPAIRING (최대 2회)
 │         2회 실패 → QUARANTINE
 ▼
UPLOADING
 │ 성공: UploadResult
 │ 실패 → tenacity 재시도 (3회, exponential backoff)
 │         3회 실패 → DEAD_LETTER + 파이프라인 중단
 ▼
EVALUATING
 │ 일치: /processed 이동 → 다음 파일
 │ 불일치: 누락분 UPLOADING 재시도
 ▼
DONE (모든 파일 처리 완료)
```

---

## 에러 에스컬레이션 정책

| 수준 | 조건 | 행동 |
|---|---|---|
| WARN | 빈 파일, 중복 파일, 스킵 가능 오류 | 로그 기록 + 다음 파일 진행 |
| ERROR | 파싱 실패, 스키마 오류 (복구 가능) | repair_agent 호출, 2회 후 QUARANTINE |
| FATAL | DB 연결 불가, 스키마 파괴, 치명적 오류 | 즉시 중단 + pipeline_state.json 저장 |

---

## 상태 영속화 규약 (pipeline_state.json)

```json
{
  "run_id": "uuid",
  "started_at": "ISO8601",
  "current_file": "01_강의명.md",
  "stage": "UPLOADING",
  "retry_count": 1,
  "processed": ["00_intro.md"],
  "quarantined": [],
  "dead_letter": [],
  "stats": {
    "total": 5,
    "success": 1,
    "failed": 0,
    "skipped": 0
  }
}
```

파이프라인 재시작 시 이 파일을 읽어 `processed` 목록은 건너뛰고 재개한다.

---

## 품질 게이트 통과 기준

- **validator 통과**: 필수 필드(`id`, `title`, `courseId`, `slides`) 100% 충족 + `slides` 배열 1개 이상
- **evaluator 통과**: DB 저장 레코드 수 = 파싱된 슬라이드 수 (허용 오차 0)
- **완료 조건**: evaluator 통과 후 .md 파일이 `/processed`로 이동된 상태

---

## 파일 넘버링 규약 (/inputs)

```
01_강의제목.md
02_다음강의.md
10_심화내용.md
```

- 2자리 숫자 접두사 + 언더스코어 + 제목 (공백 없이)
- scanner_agent가 자연어 정렬로 순서 보장
