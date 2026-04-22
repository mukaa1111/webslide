import hashlib
import logging
import re
from typing import List, Optional, Tuple, Any, Dict

import frontmatter

from .models import (
    MdFileInfo, ParsedDocument, SlideMeta, SlideData, ContentBlock, ParseError,
)

logger = logging.getLogger(__name__)

VALID_LEVELS = {"beginner", "intermediate", "advanced"}
VALID_LAYOUTS = {"default", "code-only", "bullet-list", "image-focus", "title-only", "diagram", "statement", "compare"}

_OUTER_FENCE_RE = re.compile(r"^```(?:markdown|md)?\s*\n(.*)\n```\s*$", re.DOTALL)


def _strip_outer_fence(content: str) -> str:
    """AI 출력물이 ```markdown ... ``` 으로 감싸진 경우 벗겨낸다."""
    m = _OUTER_FENCE_RE.match(content.strip())
    return m.group(1) if m else content


# ── Layout detection ─────────────────────────────────────────────────────────

def _detect_layout(blocks: List[ContentBlock]) -> str:
    non_heading = [b for b in blocks if b.type != "heading"]
    if not non_heading:
        return "title-only"
    if len(blocks) == 1 and blocks[0].type == "heading":
        return "title-only"
    if all(b.type == "code" for b in non_heading):
        return "code-only"
    if any(b.type == "image" for b in non_heading) and len(non_heading) <= 2:
        return "image-focus"
    if any(b.type == "list" for b in blocks) and not any(b.type == "code" for b in blocks):
        return "bullet-list"
    return "default"


def _get_slide_title(blocks: List[ContentBlock]) -> Optional[str]:
    for b in blocks:
        if b.type == "heading" and b.depth in (1, 2):
            return b.text
    return None


# ── Markdown section parser ───────────────────────────────────────────────────

def _parse_section_to_blocks(section: str) -> Tuple[List[ContentBlock], Optional[str], Optional[str]]:
    """Line-by-line markdown → ContentBlock list. Returns (blocks, notes, type_hint)."""
    # Extract <!-- type: xxx --> hint and strip it from content
    type_hint: Optional[str] = None
    type_match = re.search(r"<!--\s*type:\s*(\w[\w-]*)\s*-->", section, re.IGNORECASE)
    if type_match:
        type_hint = type_match.group(1).lower()
        section = re.sub(r"<!--\s*type:\s*\w[\w-]*\s*-->", "", section, flags=re.IGNORECASE).strip()

    blocks: List[ContentBlock] = []
    notes: Optional[str] = None
    lines = section.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]

        # Heading
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            blocks.append(ContentBlock(type="heading", depth=len(m.group(1)), text=m.group(2).strip()))
            i += 1
            continue

        # Fenced code block
        if line.startswith("```") or line.startswith("~~~"):
            fence = line[:3]
            lang_tag = line[3:].strip() or None
            code_lines: List[str] = []
            i += 1
            while i < len(lines) and not lines[i].startswith(fence):
                code_lines.append(lines[i])
                i += 1
            blocks.append(ContentBlock(type="code", lang=lang_tag, text="\n".join(code_lines)))
            i += 1  # skip closing fence
            continue

        # Thematic break (--- handled at split level, but may appear inside)
        if re.match(r"^(---|\*\*\*|___)\s*$", line):
            blocks.append(ContentBlock(type="divider"))
            i += 1
            continue

        # Blockquote
        if line.startswith("> "):
            quote_lines: List[str] = []
            while i < len(lines) and lines[i].startswith("> "):
                quote_lines.append(lines[i][2:])
                i += 1
            text = "\n".join(quote_lines).strip()
            lower = text.lower()
            if lower.startswith("notes:") or lower.startswith("발표자 노트:"):
                notes = text.split(":", 1)[1].strip()
            else:
                blocks.append(ContentBlock(type="blockquote", text=text))
            continue

        # Unordered list
        if re.match(r"^[-*+]\s+", line):
            items: List[Dict] = []
            while i < len(lines) and re.match(r"^[-*+]\s+", lines[i]):
                item_text = re.sub(r"^[-*+]\s+", "", lines[i]).strip()
                items.append({"text": item_text})
                i += 1
            blocks.append(ContentBlock(type="list", ordered=False, items=items))
            continue

        # Ordered list
        if re.match(r"^\d+\.\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i]):
                item_text = re.sub(r"^\d+\.\s+", "", lines[i]).strip()
                items.append({"text": item_text})
                i += 1
            blocks.append(ContentBlock(type="list", ordered=True, items=items))
            continue

        # Table (detect by | separator)
        if "|" in line and i + 1 < len(lines) and re.match(r"^\|?[\s\-|:]+\|", lines[i + 1]):
            headers = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2  # skip header + separator
            rows: List[List[str]] = []
            while i < len(lines) and "|" in lines[i]:
                row_cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(row_cells)
                i += 1
            blocks.append(ContentBlock(type="table", headers=headers, rows=rows))
            continue

        # Inline image on its own line
        img_m = re.match(r"^!\[([^\]]*)\]\(([^\)]+)\)\s*$", line)
        if img_m:
            blocks.append(ContentBlock(type="image", alt=img_m.group(1), url=img_m.group(2)))
            i += 1
            continue

        # Paragraph (collect consecutive non-empty lines)
        if line.strip():
            para_lines: List[str] = []
            while i < len(lines) and lines[i].strip():
                para_lines.append(lines[i].strip())
                i += 1
            text = " ".join(para_lines)
            blocks.append(ContentBlock(type="paragraph", text=text))
            continue

        i += 1

    return blocks, notes, type_hint


# ── Slide splitting ───────────────────────────────────────────────────────────

def _split_into_sections(body: str) -> List[str]:
    # Split by --- on its own line
    sections = re.split(r"^---\s*$", body, flags=re.MULTILINE)
    sections = [s.strip() for s in sections if s.strip()]
    if len(sections) > 1:
        return sections

    # Fallback: split by H2
    h2 = re.split(r"(?=^## )", body, flags=re.MULTILINE)
    h2 = [s.strip() for s in h2 if s.strip()]
    if len(h2) > 1:
        return h2

    # Fallback: split by H1
    h1 = re.split(r"(?=^# )", body, flags=re.MULTILINE)
    h1 = [s.strip() for s in h1 if s.strip()]
    if len(h1) > 1:
        return h1

    return [body.strip()] if body.strip() else []


# ── Slugify ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"[^\w가-힣-]", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def _compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


# ── Main parse entry ──────────────────────────────────────────────────────────

def parse(file_info: MdFileInfo) -> ParsedDocument:
    content = _strip_outer_fence(file_info.content)
    raw_hash = _compute_hash(content)
    auto_generated = False

    # Parse frontmatter
    try:
        post = frontmatter.loads(content)
        meta_dict: dict = dict(post.metadata)
        body: str = post.content
    except Exception as exc:
        logger.warning(f"FRONTMATTER_SYNTAX: {file_info.name} — {exc}")
        body = re.sub(r"^---\s*\n.*?\n---\s*\n", "", content, flags=re.DOTALL)
        meta_dict = {}

    # courseId 누락 시 복구 불가 에러 — validator의 MISSING_COURSE_ID(FATAL)와 일치
    if not meta_dict.get("courseId"):
        return ParsedDocument(
            source_file=file_info.name,
            raw_md_hash=raw_hash,
            meta=SlideMeta(courseId="", title=meta_dict.get("title") or file_info.title),
            slides=[],
            _auto_generated=False,
            error=ParseError(
                code="FRONTMATTER_MISSING",
                message="courseId가 frontmatter에 없음 — 복구 불가",
                recoverable=False,
            ),
        )

    # Normalize tags
    tags = meta_dict.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    elif not isinstance(tags, list):
        tags = []

    # Normalize level
    level = meta_dict.get("level")
    if level and level not in VALID_LEVELS:
        level = None

    # Normalize duration
    duration = meta_dict.get("duration")
    if duration is not None:
        try:
            duration = int(duration)
            if duration < 0:
                duration = None
        except (TypeError, ValueError):
            duration = None

    course_id = _slugify(str(meta_dict.get("courseId", ""))) or f"auto-{file_info.stem}"

    meta = SlideMeta(
        courseId=course_id,
        title=meta_dict.get("title") or file_info.title,
        order=meta_dict.get("order") or file_info.session_number,
        level=level,
        duration=duration,
        tags=tags,
        author=meta_dict.get("author"),
    )

    # Split body into slide sections
    sections = _split_into_sections(body)

    if not sections:
        return ParsedDocument(
            source_file=file_info.name,
            raw_md_hash=raw_hash,
            meta=meta,
            slides=[],
            _auto_generated=auto_generated,
            error=ParseError(
                code="NO_SLIDES",
                message="슬라이드 분리 실패: --- 구분자 없음, H2/H1 헤딩도 없음",
                recoverable=True,
            ),
        )

    slides: List[SlideData] = []
    for idx, section in enumerate(sections):
        if not section.strip():
            continue
        try:
            blocks, notes, type_hint = _parse_section_to_blocks(section)
        except Exception as exc:
            logger.error(f"PARSE_EXCEPTION: {file_info.name} 슬라이드 {idx} — {exc}")
            blocks = [ContentBlock(type="paragraph", text=section[:500])]
            notes = None
            type_hint = None

        title = _get_slide_title(blocks)
        layout = type_hint if type_hint in VALID_LAYOUTS else _detect_layout(blocks)
        slides.append(SlideData(index=idx, title=title, layout=layout, blocks=blocks, notes=notes))

    if not slides:
        return ParsedDocument(
            source_file=file_info.name,
            raw_md_hash=raw_hash,
            meta=meta,
            slides=[],
            _auto_generated=auto_generated,
            error=ParseError(code="NO_SLIDES", message="파싱 후 슬라이드 0개", recoverable=True),
        )

    if len(slides) > 50:
        logger.warning(f"SLIDE_COUNT_HIGH: {file_info.name} — {len(slides)}개 슬라이드")

    # Auto-fill duration if missing
    if meta.duration is None:
        meta.duration = len(slides) * 2

    return ParsedDocument(
        source_file=file_info.name,
        raw_md_hash=raw_hash,
        meta=meta,
        slides=slides,
        _auto_generated=auto_generated,
        degraded=False,
    )
