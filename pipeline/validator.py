import json
import logging
import re
from pathlib import Path
from typing import List

import jsonschema

from .models import ParsedDocument, ValidationResult, ValidationError

logger = logging.getLogger(__name__)

_SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "slide_schema.json"
_SCHEMA: dict = {}


def _load_schema() -> dict:
    global _SCHEMA
    if not _SCHEMA:
        with open(_SCHEMA_PATH, encoding="utf-8") as f:
            _SCHEMA = json.load(f)
    return _SCHEMA


_SLUG_RE = re.compile(r"^[a-z0-9가-힣][a-z0-9가-힣\-]*$")
_VALID_LEVELS = {"beginner", "intermediate", "advanced"}


def validate(doc: ParsedDocument) -> ValidationResult:
    errors: List[ValidationError] = []
    warnings: List[str] = []

    schema = _load_schema()

    # JSON Schema validation
    try:
        jsonschema.validate(instance=doc.to_dict(), schema=schema)
    except jsonschema.ValidationError as exc:
        field_path = ".".join(str(p) for p in exc.absolute_path) or "root"
        errors.append(ValidationError(
            code="SCHEMA_VIOLATION",
            field=field_path,
            message=exc.message,
            fixable=True,
        ))
    except Exception as exc:
        logger.error(f"SCHEMA_CHECK_ERROR: {exc}")

    meta = doc.meta

    # Business rules ─────────────────────────────────────────────────────────

    if not meta.courseId:
        errors.append(ValidationError(
            code="MISSING_COURSE_ID",
            field="meta.courseId",
            message="courseId가 완전히 누락됨 — 복구 불가",
            fixable=False,
        ))
    elif not _SLUG_RE.match(meta.courseId):
        errors.append(ValidationError(
            code="INVALID_SLUG",
            field="meta.courseId",
            message=f"courseId '{meta.courseId}'가 slug 형식(영소문자·숫자·한글·하이픈)을 위반함",
            fixable=True,
        ))

    if not meta.title:
        errors.append(ValidationError(
            code="MISSING_TITLE",
            field="meta.title",
            message="meta.title이 없음",
            fixable=True,
        ))
    elif len(meta.title) > 200:
        errors.append(ValidationError(
            code="TITLE_TOO_LONG",
            field="meta.title",
            message=f"title이 200자 초과: {len(meta.title)}자",
            fixable=True,
        ))

    if meta.level and meta.level not in _VALID_LEVELS:
        errors.append(ValidationError(
            code="INVALID_LEVEL",
            field="meta.level",
            message=f"level '{meta.level}'은 허용 범위 밖 (beginner|intermediate|advanced)",
            fixable=True,
        ))

    if meta.duration is not None and meta.duration < 0:
        errors.append(ValidationError(
            code="NEGATIVE_DURATION",
            field="meta.duration",
            message="duration이 음수",
            fixable=True,
        ))

    if not doc.slides:
        errors.append(ValidationError(
            code="NO_SLIDES",
            field="slides",
            message="slides 배열이 비어있음",
            fixable=True,
        ))

    # Slide-level checks ──────────────────────────────────────────────────────
    seen_indices = set()
    for slide in doc.slides:
        if slide.index in seen_indices:
            errors.append(ValidationError(
                code="DUPLICATE_SLIDE_INDEX",
                field=f"slides[{slide.index}].index",
                message=f"슬라이드 인덱스 {slide.index} 중복",
                fixable=True,
            ))
        seen_indices.add(slide.index)

        for j, block in enumerate(slide.blocks):
            if block.type == "code" and not block.lang:
                warnings.append(f"slide[{slide.index}].blocks[{j}]: code 블록에 lang 미지정")
            if block.type == "image" and not block.alt:
                warnings.append(f"slide[{slide.index}].blocks[{j}]: image 블록 alt 없음")

    if len(doc.slides) > 50:
        warnings.append(f"SLIDE_COUNT_HIGH: {len(doc.slides)}개 슬라이드 (권장 ≤ 50)")

    # Duration mismatch warning
    if meta.duration and doc.slides:
        expected_approx = len(doc.slides) * 2
        if abs(meta.duration - expected_approx) > expected_approx:
            warnings.append(f"DURATION_MISMATCH: duration={meta.duration}분, 슬라이드 수={len(doc.slides)}")

    ok = all(e.fixable for e in errors)

    for w in warnings:
        logger.warning(w)

    return ValidationResult(ok=ok, parsed=doc, errors=errors, warnings=warnings)
