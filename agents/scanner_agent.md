# scanner_agent

## 단일 책임
`/inputs` 폴더를 1회 전수 스캔하여, 처리할 .md 파일 목록(FileQueue)을 생성한다.
watchdog 없음 — `run.py` 실행 시점에 한 번만 동작하고 종료한다.

## 입력
```python
input_folder: Path        # "/inputs"
skip_list: list[str]      # pipeline_state.json의 processed 목록
```

## 출력
```python
@dataclass
class MdFileInfo:
    path: Path
    name: str             # "01_강의제목.md"
    stem: str             # "01_강의제목"
    session_number: int   # 1 (파일명 앞 숫자)
    title: str            # "강의제목"
    size_bytes: int
    encoding: str         # 감지된 인코딩
    content: str          # 파일 내용 (utf-8-sig 우선)

FileQueue = list[MdFileInfo]  # 자연어 정렬 완료 상태
```

## 처리 로직

### 1. 폴더 스캔
```python
files = list(Path(input_folder).rglob("*.md"))
# 숨김 파일/폴더 제외: not any(part.startswith('.') for part in f.parts)
# skip_list에 있는 파일 제외 (이미 processed)
```

### 2. 자연어 정렬
```python
# "01_..." "02_..." "10_..." 순서 보장
key = lambda f: [int(x) if x.isdigit() else x.lower()
                 for x in re.split(r'(\d+)', f.name)]
```

### 3. 파일명 파싱
```python
# "01_파이썬_기초.md" → session_number=1, title="파이썬 기초"
match = re.match(r'^(\d+)[_\-](.+)$', stem)
```

### 4. 인코딩 폴백 체인
```
utf-8-sig → utf-8 → cp949 → euc-kr → latin-1
```
BOM 자동 제거. 마지막 수단: `errors='replace'` + WARN 로그.

### 5. 최소 크기 필터
```python
MIN_FILE_SIZE = 10  # bytes
# 빈 파일 또는 10바이트 미만: WARN 로그 + 스킵
```

## 에러 처리

| 오류 | 수준 | 행동 |
|---|---|---|
| /inputs 폴더 없음 | WARN | 폴더 자동 생성 후 빈 큐 반환 |
| 파일 읽기 권한 없음 | WARN | 해당 파일 스킵 |
| 빈 파일 (0바이트) | WARN | 스킵 |
| 인코딩 감지 실패 | WARN | 손실 허용 디코딩 + 계속 |
| .md 파일 0개 | WARN | 빈 큐 반환 (파이프라인 즉시 종료) |

## 콘솔 출력 예시
```
[scanner] /inputs 스캔 시작...
[scanner] 발견: 5개 파일 (스킵: 1개 - 이미 처리됨)
[scanner]   01_파이썬기초.md (2.3 KB, utf-8)
[scanner]   02_함수와클래스.md (4.1 KB, utf-8-sig)
[scanner] 처리 큐 생성 완료 → 4개 파일 대기 중
```
