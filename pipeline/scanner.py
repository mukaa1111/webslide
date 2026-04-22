import os
import re
import logging
from pathlib import Path
from typing import List, Optional

import chardet

from .models import MdFileInfo

logger = logging.getLogger(__name__)

MIN_FILE_SIZE = int(os.getenv("MIN_FILE_SIZE_BYTES", "10"))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "5")) * 1024 * 1024
ENCODING_CHAIN = ["utf-8-sig", "utf-8", "cp949", "euc-kr", "latin-1"]
NUM_PREFIX_RE = re.compile(r"^(\d+)_(.+)$")


def _natural_sort_key(name: str) -> list:
    parts = re.split(r"(\d+)", name)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


def _detect_encoding(raw: bytes) -> Optional[str]:
    if b"\x00" in raw:
        return None  # binary content

    detected = chardet.detect(raw)
    enc_hint = (detected.get("encoding") or "").lower().replace("-", "").replace("_", "")

    for enc in ENCODING_CHAIN:
        if enc_hint == enc.lower().replace("-", ""):
            try:
                raw.decode(enc)
                return enc
            except (UnicodeDecodeError, LookupError):
                pass

    for enc in ENCODING_CHAIN:
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue

    return None


def scan(inputs_dir: str, processed: List[str]) -> List[MdFileInfo]:
    inputs_path = Path(inputs_dir)

    if not inputs_path.exists():
        inputs_path.mkdir(parents=True, exist_ok=True)
        logger.warning(f"SCANNER_DIR_MISSING: /inputs 폴더가 없어 생성했습니다: {inputs_dir}")
        return []

    md_files = sorted(
        [
            f for f in inputs_path.glob("*.md")
            if not any(part.startswith(".") for part in f.parts)
            and not f.is_symlink()
        ],
        key=lambda f: _natural_sort_key(f.name),
    )

    if not md_files:
        logger.warning("SCANNER_EMPTY_QUEUE: .md 파일이 없습니다.")
        return []

    queue: List[MdFileInfo] = []
    seen_stems: set = set()
    session_counter = 1

    for filepath in md_files:
        name = filepath.name
        stem = filepath.stem

        if stem in seen_stems:
            logger.warning(f"SCANNER_DUPLICATE_STEM: 중복 파일명 스킵: {name}")
            continue
        seen_stems.add(stem)

        if name in processed:
            logger.info(f"이미 처리된 파일 스킵: {name}")
            continue

        size = filepath.stat().st_size
        if size < MIN_FILE_SIZE:
            logger.warning(f"SCANNER_FILE_TOO_SMALL: {name} ({size} bytes)")
            continue
        if size > MAX_FILE_SIZE:
            logger.warning(f"SCANNER_FILE_TOO_LARGE: {name} ({size / 1024 / 1024:.1f} MB)")
            continue

        try:
            raw = filepath.read_bytes()
        except PermissionError:
            logger.warning(f"SCANNER_PERMISSION_DENIED: {name}")
            continue

        encoding = _detect_encoding(raw)
        if encoding is None:
            if b"\x00" in raw:
                logger.warning(f"SCANNER_BINARY_CONTENT: {name}")
            else:
                logger.warning(f"SCANNER_ENCODING_FAILED: {name}")
            continue

        content = raw.decode(encoding, errors="replace")

        m = NUM_PREFIX_RE.match(stem)
        title = m.group(2).replace("-", " ").replace("_", " ") if m else stem.replace("-", " ").replace("_", " ")

        queue.append(MdFileInfo(
            path=str(filepath),
            name=name,
            stem=stem,
            session_number=session_counter,
            title=title,
            size_bytes=size,
            encoding=encoding,
            content=content,
        ))
        session_counter += 1

    logger.info(f"스캔 완료: {len(queue)}개 파일 처리 예정 (전체 {len(md_files)}개 중)")
    return queue
