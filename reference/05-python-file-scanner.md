# Python 파일 스캔 및 순차 읽기 기술 레퍼런스

## VOD-to-Knowledge 파이프라인 — `/inputs` 폴더 `.md` 파일 처리

---

## 목차

1. [폴더 스캔 방법 비교: os, pathlib, glob](#1-폴더-스캔-방법-비교)
2. [순차 읽기 및 인코딩 처리](#2-순차-읽기-및-인코딩-처리)
3. [파일 메타데이터 추출 및 정렬 전략](#3-파일-메타데이터-추출-및-정렬-전략)
4. [폴더 감시: watchdog 라이브러리](#4-폴더-감시-watchdog-라이브러리)
5. [에러 처리](#5-에러-처리)
6. [진행률 추적 (배치 처리)](#6-진행률-추적-배치-처리)
7. [통합 파이프라인 예제](#7-통합-파이프라인-예제)

---

## 1. 폴더 스캔 방법 비교

### 1.1 개요 비교표

| 기준 | `os` 모듈 | `pathlib` 모듈 | `glob` 모듈 |
|---|---|---|---|
| Python 버전 | 2.x ~ | 3.4+ | 2.x ~ |
| 객체 지향 | 아니오 | 예 (`Path` 객체) | 아니오 |
| 재귀 지원 | `os.walk()` | `.rglob()` | `**` 패턴 (3.5+) |
| 가독성 | 보통 | 높음 | 보통 |
| 메타데이터 접근 | `os.stat()` 별도 호출 | `.stat()` 메서드 | 별도 호출 필요 |
| 권장 여부 | 레거시 호환 시 | **신규 코드 권장** | 단순 패턴 매칭 시 |

---

### 1.2 `os` 모듈

```python
import os

def scan_with_os(folder: str, recursive: bool = True) -> list[str]:
    md_files = []

    if recursive:
        for root, dirs, files in os.walk(folder):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                if file.lower().endswith('.md'):
                    md_files.append(os.path.join(root, file))
    else:
        for file in os.listdir(folder):
            if file.lower().endswith('.md'):
                full_path = os.path.join(folder, file)
                if os.path.isfile(full_path):
                    md_files.append(full_path)

    return md_files
```

---

### 1.3 `pathlib` 모듈 (권장)

```python
from pathlib import Path

def scan_with_pathlib(folder: str | Path, recursive: bool = True) -> list[Path]:
    base = Path(folder)
    
    if recursive:
        md_files = list(base.rglob('*.md'))
    else:
        md_files = list(base.glob('*.md'))

    # 숨김 파일 및 폴더 하위 항목 필터링
    md_files = [
        f for f in md_files
        if not any(part.startswith('.') for part in f.parts)
    ]

    return md_files


# 사용 예시
files = scan_with_pathlib('/inputs')
for f in files:
    print(f.name)          # 파일명만
    print(f.stem)          # 확장자 제외 이름
    print(f.parent)        # 부모 디렉터리
    print(f.resolve())     # 절대 경로
```

---

### 1.4 `glob` 모듈

```python
import glob

def scan_with_glob(folder: str, recursive: bool = True) -> list[str]:
    if recursive:
        pattern = f"{folder}/**/*.md"
        return glob.glob(pattern, recursive=True)
    else:
        pattern = f"{folder}/*.md"
        return glob.glob(pattern)


# glob.iglob: 제너레이터 버전 (메모리 효율적)
def scan_with_iglob(folder: str):
    pattern = f"{folder}/**/*.md"
    for filepath in glob.iglob(pattern, recursive=True):
        yield filepath
```

> **권장**: `pathlib.rglob()` 사용. 코드 가독성 및 유지보수성이 가장 뛰어납니다.

---

## 2. 순차 읽기 및 인코딩 처리

### 2.1 UTF-8 기본 읽기

```python
from pathlib import Path

def read_md_file(filepath: Path) -> str:
    return filepath.read_text(encoding='utf-8')
```

### 2.2 BOM(Byte Order Mark) 처리

NotebookLM 또는 Windows에서 저장한 파일은 UTF-8 BOM을 포함할 수 있습니다.

```python
def read_with_bom_handling(filepath: Path) -> str:
    # 'utf-8-sig' 코덱: BOM이 있으면 제거, 없으면 일반 UTF-8로 읽음
    return filepath.read_text(encoding='utf-8-sig')
```

### 2.3 견고한 인코딩 처리 (폴백 체인)

```python
from pathlib import Path

ENCODING_FALLBACK_CHAIN = ['utf-8-sig', 'utf-8', 'cp949', 'euc-kr', 'latin-1']

def read_with_fallback(filepath: Path) -> tuple[str, str]:
    """
    인코딩 폴백 체인을 순서대로 시도합니다.
    Returns: (content, used_encoding)
    """
    raw = filepath.read_bytes()
    
    for enc in ENCODING_FALLBACK_CHAIN:
        try:
            content = raw.decode(enc)
            content = content.lstrip('\ufeff')  # BOM 제거
            return content, enc
        except (UnicodeDecodeError, LookupError):
            continue
    
    # 최후 수단: 손실 허용 디코딩
    content = raw.decode('utf-8', errors='replace')
    return content, 'utf-8 (손실 허용)'
```

### 2.4 대용량 파일 스트리밍 읽기

```python
from pathlib import Path
from typing import Generator

def read_md_lines(filepath: Path, encoding: str = 'utf-8-sig') -> Generator[str, None, None]:
    """줄 단위 스트리밍 읽기 제너레이터."""
    with open(filepath, encoding=encoding, errors='replace') as f:
        for line in f:
            yield line.rstrip('\n')
```

---

## 3. 파일 메타데이터 추출 및 정렬 전략

### 3.1 메타데이터 추출

```python
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime

@dataclass
class MdFileInfo:
    path: Path
    name: str
    stem: str
    size_bytes: int
    modified_time: datetime
    relative_path: str
    depth: int


def extract_metadata(filepath: Path, base_folder: Path) -> MdFileInfo:
    stat = filepath.stat()
    
    return MdFileInfo(
        path=filepath,
        name=filepath.name,
        stem=filepath.stem,
        size_bytes=stat.st_size,
        modified_time=datetime.fromtimestamp(stat.st_mtime),
        relative_path=str(filepath.relative_to(base_folder)),
        depth=len(filepath.relative_to(base_folder).parts) - 1,
    )
```

### 3.2 정렬 전략

```python
import re
from pathlib import Path

def get_md_files_sorted(folder: Path, strategy: str = 'natural') -> list[Path]:
    """
    strategy: 'name' | 'modified' | 'modified_desc' | 'natural'
    """
    files = list(folder.rglob('*.md'))

    if strategy == 'name':
        return sorted(files, key=lambda f: f.name.lower())
    elif strategy == 'modified':
        return sorted(files, key=lambda f: f.stat().st_mtime)
    elif strategy == 'modified_desc':
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)
    elif strategy == 'natural':
        def natural_key(path: Path):
            parts = re.split(r'(\d+)', path.name.lower())
            return [int(p) if p.isdigit() else p for p in parts]
        return sorted(files, key=natural_key)
    return files

# 자연어 정렬: lecture_1, lecture_2, lecture_10 순 (숫자를 정수로 비교)
```

### 3.3 파일명 기반 메타데이터 파싱 (NotebookLM 파일명)

```python
import re
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass

@dataclass
class ParsedFilename:
    original: str
    date: datetime | None
    session_number: int | None
    title: str


def parse_notebooklm_filename(filepath: Path) -> ParsedFilename:
    """
    지원 형식:
        - 2024-01-15_강의제목.md
        - session_03_Python기초.md
        - 01_introduction.md
    """
    stem = filepath.stem
    date = None
    session_num = None
    title = stem

    date_match = re.match(r'^(\d{4}-\d{2}-\d{2})_(.+)$', stem)
    if date_match:
        try:
            date = datetime.strptime(date_match.group(1), '%Y-%m-%d')
            title = date_match.group(2)
        except ValueError:
            pass

    session_match = re.match(r'^(?:session_)?(\d+)[_\-\s](.+)$', title, re.IGNORECASE)
    if session_match:
        session_num = int(session_match.group(1))
        title = session_match.group(2)

    return ParsedFilename(
        original=filepath.name,
        date=date,
        session_number=session_num,
        title=title.replace('_', ' '),
    )
```

---

## 4. 폴더 감시: watchdog 라이브러리

### 4.1 설치

```bash
pip install watchdog
```

### 4.2 기본 이벤트 핸들러

```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pathlib import Path
import time
import logging

logger = logging.getLogger(__name__)


class MdFileHandler(FileSystemEventHandler):
    def __init__(self, callback):
        super().__init__()
        self.callback = callback
        self._processing = set()

    def on_created(self, event):
        if not event.is_directory:
            path = Path(event.src_path)
            if path.suffix.lower() == '.md':
                self._safe_process(path)

    def on_modified(self, event):
        if not event.is_directory:
            path = Path(event.src_path)
            if path.suffix.lower() == '.md' and path not in self._processing:
                self._safe_process(path)

    def _safe_process(self, path: Path):
        self._processing.add(path)
        try:
            self._wait_for_file_ready(path)
            self.callback(path)
        finally:
            self._processing.discard(path)

    def _wait_for_file_ready(self, path: Path, timeout: float = 5.0):
        """파일 크기가 안정될 때까지 대기 (쓰기 완료 감지)."""
        import time
        deadline = time.time() + timeout
        prev_size = -1
        while time.time() < deadline:
            try:
                current_size = path.stat().st_size
                if current_size == prev_size and current_size > 0:
                    return
                prev_size = current_size
            except FileNotFoundError:
                pass
            time.sleep(0.1)


def start_watching(folder: str = '/inputs', callback=None):
    if callback is None:
        callback = lambda p: logger.info(f"새 파일: {p.name}")

    watch_path = Path(folder)
    watch_path.mkdir(parents=True, exist_ok=True)

    handler = MdFileHandler(callback=callback)
    observer = Observer()
    observer.schedule(handler, str(watch_path), recursive=True)
    observer.start()

    logger.info(f"감시 시작: {watch_path.resolve()}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()
```

---

## 5. 에러 처리

### 5.1 에러 유형별 처리

```python
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import os

@dataclass
class ReadResult:
    filepath: Path
    success: bool
    content: Optional[str] = None
    encoding_used: Optional[str] = None
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    warnings: list[str] = field(default_factory=list)


def safe_read_md(filepath: Path) -> ReadResult:
    result = ReadResult(filepath=filepath, success=False)

    if not filepath.exists():
        result.error_type = 'FileNotFound'
        result.error_message = f"파일 없음: {filepath}"
        return result

    if not filepath.is_file():
        result.error_type = 'NotAFile'
        result.error_message = f"파일이 아님: {filepath}"
        return result

    if not os.access(filepath, os.R_OK):
        result.error_type = 'PermissionError'
        result.error_message = f"읽기 권한 없음: {filepath}"
        return result

    if filepath.stat().st_size == 0:
        result.error_type = 'EmptyFile'
        result.content = ''
        result.warnings.append('빈 파일입니다.')
        result.success = True
        return result

    ENCODINGS = ['utf-8-sig', 'utf-8', 'cp949', 'euc-kr', 'latin-1']
    try:
        raw = filepath.read_bytes()
    except OSError as e:
        result.error_type = 'IOError'
        result.error_message = str(e)
        return result

    for enc in ENCODINGS:
        try:
            result.content = raw.decode(enc).lstrip('\ufeff')
            result.encoding_used = enc
            result.success = True
            return result
        except (UnicodeDecodeError, LookupError):
            continue

    result.content = raw.decode('utf-8', errors='replace')
    result.encoding_used = 'utf-8 (손실 허용)'
    result.success = True
    result.warnings.append('인코딩 감지 실패 — 일부 문자 대체됨')
    return result
```

### 5.2 안전한 폴더 스캔

```python
from pathlib import Path
from typing import Generator
import os

def safe_scan_folder(folder: str | Path) -> Generator[Path, None, None]:
    base = Path(folder)

    if not base.exists():
        base.mkdir(parents=True, exist_ok=True)
        return

    if not base.is_dir():
        raise NotADirectoryError(f"디렉터리가 아님: {base}")

    if not os.access(base, os.R_OK | os.X_OK):
        raise PermissionError(f"접근 권한 없음: {base}")

    yield from _walk_safe(base)


def _walk_safe(directory: Path) -> Generator[Path, None, None]:
    try:
        entries = list(directory.iterdir())
    except PermissionError:
        return

    for entry in entries:
        if entry.is_file() and entry.suffix.lower() == '.md':
            yield entry
        elif entry.is_dir() and not entry.name.startswith('.'):
            yield from _walk_safe(entry)
```

---

## 6. 진행률 추적 (배치 처리)

### 6.1 tqdm 기반

```bash
pip install tqdm
```

```python
from pathlib import Path
from tqdm import tqdm

def process_batch_with_tqdm(folder: Path):
    files = sorted(folder.rglob('*.md'), key=lambda f: f.name.lower())

    with tqdm(total=len(files), desc="MD 파일 처리", unit="파일", colour='green') as pbar:
        for filepath in files:
            pbar.set_postfix_str(filepath.name[:30])
            result = safe_read_md(filepath)
            # 처리 로직 ...
            pbar.update(1)
```

### 6.2 JSON Lines 로깅 (CI/CD 환경)

```python
from pathlib import Path
from datetime import datetime
import json


class JsonlProgressLogger:
    def __init__(self, log_path: Path):
        self._handle = open(log_path, 'w', encoding='utf-8')

    def log(self, event: str, **kwargs):
        record = {'ts': datetime.now().isoformat(), 'event': event, **kwargs}
        self._handle.write(json.dumps(record, ensure_ascii=False) + '\n')
        self._handle.flush()

    def close(self):
        self._handle.close()

    def __enter__(self): return self
    def __exit__(self, *_): self.close()
```

---

## 7. 통합 파이프라인 예제

### 7.1 완성형 파이프라인 클래스

```python
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional
import logging
import re

logger = logging.getLogger('VODPipeline')


@dataclass
class PipelineConfig:
    input_folder: Path = Path('/inputs')
    output_folder: Path = Path('/outputs')
    recursive: bool = True
    sort_strategy: str = 'natural'
    skip_empty_files: bool = True
    min_file_size_bytes: int = 10
    watch_mode: bool = False


class VODKnowledgePipeline:
    def __init__(self, config: PipelineConfig, processor: Optional[Callable] = None):
        self.config = config
        self.processor = processor or self._default_processor

    def run(self):
        cfg = self.config
        cfg.input_folder.mkdir(parents=True, exist_ok=True)
        cfg.output_folder.mkdir(parents=True, exist_ok=True)

        if cfg.watch_mode:
            self._run_watch_mode()
        else:
            self._run_batch_mode()

    def _run_batch_mode(self):
        files = self._collect_files()
        if not files:
            logger.warning(f"처리할 파일 없음: {self.config.input_folder}")
            return

        logger.info(f"발견된 파일: {len(files)}개")
        for idx, filepath in enumerate(files, 1):
            logger.info(f"[{idx}/{len(files)}] {filepath.name}")
            result = safe_read_md(filepath)
            if result.success:
                self.processor(result.content or '', filepath)
            else:
                logger.error(f"읽기 실패: {filepath.name} — {result.error_message}")

    def _collect_files(self) -> list[Path]:
        cfg = self.config
        try:
            files = list(safe_scan_folder(cfg.input_folder))
        except Exception as e:
            logger.error(f"폴더 스캔 실패: {e}")
            return []

        if cfg.skip_empty_files:
            files = [f for f in files if f.stat().st_size >= cfg.min_file_size_bytes]

        return _sort_files(files, cfg.sort_strategy)

    def _run_watch_mode(self):
        start_watching(str(self.config.input_folder), callback=lambda p: (
            self.processor(safe_read_md(p).content or '', p)
        ))

    def _default_processor(self, content: str, filepath: Path):
        lines = content.splitlines()
        logger.info(f"  미리보기: {lines[0][:80] if lines else '(비어 있음)'}")


def _sort_files(files: list[Path], strategy: str) -> list[Path]:
    if strategy == 'name':
        return sorted(files, key=lambda f: f.name.lower())
    elif strategy == 'modified':
        return sorted(files, key=lambda f: f.stat().st_mtime)
    elif strategy == 'natural':
        def nk(p): return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', p.name)]
        return sorted(files, key=nk)
    return files
```

### 7.2 빠른 시작 스크립트

```python
#!/usr/bin/env python3
from pathlib import Path

INPUT_FOLDER = Path('/inputs')

def main():
    INPUT_FOLDER.mkdir(exist_ok=True)
    files = sorted(INPUT_FOLDER.rglob('*.md'), key=lambda f: f.name.lower())

    if not files:
        print(f"[!] {INPUT_FOLDER} 에 .md 파일이 없습니다.")
        return

    print(f"[*] {len(files)}개 파일 발견\n")

    for idx, filepath in enumerate(files, 1):
        print(f"{'='*60}")
        print(f"[{idx}/{len(files)}] {filepath.name}")
        print(f"{'='*60}")
        try:
            content = filepath.read_text(encoding='utf-8-sig')
            print(content[:500])
            if len(content) > 500:
                print(f"\n... ({len(content)-500}자 더 있음)")
        except Exception as e:
            print(f"[오류] {e}")
        print()


if __name__ == '__main__':
    main()
```

---

## 핵심 요약

| 항목 | 권장 방법 |
|---|---|
| 파일 목록 | `pathlib.Path.rglob('*.md')` |
| 파일 읽기 | `filepath.read_text(encoding='utf-8-sig')` |
| 인코딩 폴백 | `utf-8-sig` → `utf-8` → `cp949` → `latin-1` |
| 정렬 | 자연어 정렬 (`re.split(r'(\d+)', ...)`) |
| 폴더 감시 | `watchdog` + 파일 크기 안정 대기 |
| 에러 처리 | `ReadResult` 결과 객체 반환, 예외 전파 최소화 |
| 진행률 | `tqdm` (대화형) 또는 JSON Lines (자동화 환경) |
