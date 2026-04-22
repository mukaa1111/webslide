import logging
import re
from typing import List

from .models import (
    ParsedDocument, SlideMeta, SlideData, ContentBlock,
    RepairRequest, RepairResult, ValidationError,
)

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"[^\w가-힣-]", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def _fix_course_id(doc: ParsedDocument) -> str:
    fix = _slugify(doc.meta.courseId or doc.source_file.replace(".md", ""))
    logger.info(f"repair: courseId '{doc.meta.courseId}' → '{fix}'")
    return fix


def _ensure_title(doc: ParsedDocument) -> str:
    if doc.meta.title:
        return doc.meta.title
    stem = doc.source_file.replace(".md", "")
    m = re.match(r"^\d+_(.+)$", stem)
    title = (m.group(1) if m else stem).replace("-", " ").replace("_", " ")
    logger.info(f"repair: title 자동 생성 → '{title}'")
    return title


def _fix_level(doc: ParsedDocument) -> None:
    valid = {"beginner", "intermediate", "advanced"}
    if doc.meta.level and doc.meta.level not in valid:
        logger.info(f"repair: level '{doc.meta.level}' 제거")
        doc.meta.level = None


def _fix_duration(doc: ParsedDocument) -> None:
    if doc.meta.duration is None or doc.meta.duration < 0:
        doc.meta.duration = max(1, len(doc.slides) * 2)
        logger.info(f"repair: duration 기본값 주입 → {doc.meta.duration}분")


def _fix_duplicate_indices(doc: ParsedDocument) -> None:
    seen = set()
    new_slides: List[SlideData] = []
    for slide in doc.slides:
        while slide.index in seen:
            slide.index += 1
        seen.add(slide.index)
        new_slides.append(slide)
    doc.slides = new_slides


def _rebuild_slides_from_file(request: RepairRequest) -> List[SlideData]:
    """Last-resort: treat entire content as one slide."""
    content = request.file_info.content
    # Strip frontmatter
    body = re.sub(r"^---\s*\n.*?\n---\s*\n", "", content, flags=re.DOTALL).strip()

    # Try H2 split
    sections = re.split(r"(?=^## )", body, flags=re.MULTILINE)
    sections = [s.strip() for s in sections if s.strip()]

    if not sections:
        sections = [body] if body else ["(빈 파일)"]

    slides: List[SlideData] = []
    for idx, section in enumerate(sections):
        # Extract title from first heading
        title_m = re.match(r"^#{1,3}\s+(.+)$", section.splitlines()[0]) if section.splitlines() else None
        title = title_m.group(1) if title_m else f"슬라이드 {idx + 1}"
        blocks = [ContentBlock(type="paragraph", text=section[:2000])]
        slides.append(SlideData(index=idx, title=title, layout="default", blocks=blocks))

    return slides


def repair(request: RepairRequest) -> RepairResult:
    applied_fixes: List[str] = []

    try:
        doc: ParsedDocument = request.data if isinstance(request.data, ParsedDocument) else request.data.parsed
    except AttributeError:
        return RepairResult(
            success=False,
            data=None,
            applied_fixes=[],
            error="repair: 입력 데이터 형식 오류",
        )

    errors: List[ValidationError] = request.errors if isinstance(request.errors, list) else []
    error_codes = {e.code if hasattr(e, "code") else str(e) for e in errors}

    # Fix: INVALID_SLUG / empty courseId
    if "INVALID_SLUG" in error_codes or not doc.meta.courseId:
        old = doc.meta.courseId
        doc.meta.courseId = _fix_course_id(doc)
        applied_fixes.append(f"meta.courseId '{old}' → '{doc.meta.courseId}' (slugify 적용)")

    # Fix: MISSING_TITLE
    if "MISSING_TITLE" in error_codes or not doc.meta.title:
        doc.meta.title = _ensure_title(doc)
        applied_fixes.append(f"meta.title 자동 생성 → '{doc.meta.title}'")

    # Fix: INVALID_LEVEL
    if "INVALID_LEVEL" in error_codes:
        old = doc.meta.level
        _fix_level(doc)
        applied_fixes.append(f"meta.level '{old}' 제거")

    # Fix: NEGATIVE_DURATION
    if "NEGATIVE_DURATION" in error_codes:
        _fix_duration(doc)
        applied_fixes.append(f"meta.duration 기본값 주입 → {doc.meta.duration}분")

    # Fix: DUPLICATE_SLIDE_INDEX
    if "DUPLICATE_SLIDE_INDEX" in error_codes:
        _fix_duplicate_indices(doc)
        applied_fixes.append("슬라이드 인덱스 중복 해소")

    # Fix: NO_SLIDES (attempt rebuild)
    if "NO_SLIDES" in error_codes or not doc.slides:
        if request.attempt == 1:
            doc.slides = _rebuild_slides_from_file(request)
            applied_fixes.append(f"H2 기준 슬라이드 재분리 → {len(doc.slides)}개")
        else:
            # 2nd attempt: single slide fallback
            content_preview = (request.file_info.content[:1000]).strip()
            doc.slides = [SlideData(
                index=0,
                title=doc.meta.title or request.file_info.title,
                layout="default",
                blocks=[ContentBlock(type="paragraph", text=content_preview)],
            )]
            doc.degraded = True
            applied_fixes.append("전체 단일 슬라이드 병합 (degraded=true)")

    # Auto-fill duration if still missing
    if not doc.meta.duration:
        _fix_duration(doc)
        applied_fixes.append(f"duration 기본값 → {doc.meta.duration}분")

    if not doc.slides:
        return RepairResult(
            success=False,
            data=None,
            applied_fixes=applied_fixes,
            error=f"{request.attempt}회 복구 실패 — QUARANTINE 처리 요청",
        )

    logger.info(f"repair 완료 (attempt {request.attempt}): {', '.join(applied_fixes)}")
    return RepairResult(success=True, data=doc, applied_fixes=applied_fixes)
