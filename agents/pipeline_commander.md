# pipeline_commander (Orchestrator)

## 역할
전체 파이프라인을 총괄하는 지휘관. `run.py`의 메인 루프로 구현된다.
에이전트 간 데이터 라우팅, 상태 관리, 실패 정책 결정을 단독으로 수행한다.

## 핵심 원칙
- 에이전트를 직접 조율하되, 각 에이전트의 내부 로직에는 개입하지 않는다.
- 모든 상태 변경은 `pipeline_state.json`에 즉시 기록한다.
- 어떤 단일 파일의 실패도 전체 배치를 멈추지 않는다 (FATAL 제외).

## 실행 흐름 (Pseudocode)

```python
def run():
    state = load_or_init_state()
    file_queue = scanner_agent.scan(INPUT_FOLDER, skip=state.processed)

    for file_info in file_queue:
        state.current_file = file_info.name
        state.stage = "PARSING"

        # Step 1: Parse
        parsed = parser_agent.parse(file_info)
        if parsed.error:
            parsed = repair_agent.fix(parsed, attempt=1)
            if parsed.error:
                parsed = repair_agent.fix(parsed, attempt=2)
            if parsed.error:
                quarantine(file_info)
                continue

        # Step 2: Validate
        validated = validator_agent.validate(parsed)
        if not validated.ok:
            validated = repair_agent.fix(validated, attempt=1)
            if not validated.ok:
                validated = repair_agent.fix(validated, attempt=2)
            if not validated.ok:
                quarantine(file_info)
                continue

        # Step 3: Upload
        state.stage = "UPLOADING"
        result = uploader_agent.upload(validated)  # tenacity 내부 재시도
        if result.fatal:
            state.stage = "DEAD_LETTER"
            save_state(state)
            raise FatalError("DB 연결 실패 — 파이프라인 중단")

        # Step 4: Evaluate
        state.stage = "EVALUATING"
        report = evaluator_agent.evaluate(result)
        if not report.match:
            uploader_agent.upload_missing(report.missing_slides)

        state.processed.append(file_info.name)
        move_to_processed(file_info)
        save_state(state)

    print_final_report(state)
```

## 라우팅 결정 테이블

| 조건 | 행동 |
|---|---|
| parser 실패 1회 | repair_agent 호출 (attempt=1) |
| parser 실패 2회 | repair_agent 호출 (attempt=2) |
| parser 실패 3회 | quarantine + 다음 파일 |
| validator 실패 → repair 후 통과 | uploader로 진행 |
| validator 실패 2회 | quarantine + 다음 파일 |
| uploader 실패 (재시도 소진) | DEAD_LETTER + 전체 중단 |
| evaluator 불일치 | 누락 슬라이드 재업로드 1회 |

## 출력
- 콘솔: 실시간 진행 상황 (파일명, 단계, 성공/실패)
- `pipeline_state.json`: 매 파일 완료 후 갱신
- 최종 요약 리포트: 총 처리 수 / 성공 / 격리 / 소요 시간
