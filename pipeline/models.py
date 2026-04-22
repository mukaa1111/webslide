from dataclasses import dataclass, field
from typing import Optional, List, Any
from enum import Enum


class Stage(str, Enum):
    IDLE = "IDLE"
    SCANNING = "SCANNING"
    PARSING = "PARSING"
    VALIDATING = "VALIDATING"
    REPAIRING = "REPAIRING"
    UPLOADING = "UPLOADING"
    EVALUATING = "EVALUATING"
    QUARANTINE = "QUARANTINE"
    DEAD_LETTER = "DEAD_LETTER"
    DONE = "DONE"
    TERMINATED = "TERMINATED"


@dataclass
class MdFileInfo:
    path: str
    name: str
    stem: str
    session_number: int
    title: str
    size_bytes: int
    encoding: str
    content: str


@dataclass
class ContentBlock:
    type: str
    text: Optional[str] = None
    depth: Optional[int] = None
    lang: Optional[str] = None
    ordered: Optional[bool] = None
    items: Optional[List[Any]] = None
    headers: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None
    url: Optional[str] = None
    alt: Optional[str] = None
    title_attr: Optional[str] = None

    def to_dict(self) -> dict:
        d: dict = {"type": self.type}
        if self.text is not None:
            d["text"] = self.text
        if self.depth is not None:
            d["depth"] = self.depth
        if self.lang is not None:
            d["lang"] = self.lang
        if self.ordered is not None:
            d["ordered"] = self.ordered
        if self.items is not None:
            d["items"] = self.items
        if self.headers is not None:
            d["headers"] = self.headers
        if self.rows is not None:
            d["rows"] = self.rows
        if self.url is not None:
            d["url"] = self.url
        if self.alt is not None:
            d["alt"] = self.alt
        if self.title_attr is not None:
            d["title"] = self.title_attr
        return d


@dataclass
class SlideData:
    index: int
    blocks: List[ContentBlock]
    title: Optional[str] = None
    layout: str = "default"
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "title": self.title,
            "layout": self.layout,
            "blocks": [b.to_dict() for b in self.blocks],
            "notes": self.notes,
        }


@dataclass
class SlideMeta:
    courseId: str
    title: Optional[str] = None
    order: Optional[int] = None
    level: Optional[str] = None
    duration: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    author: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "courseId": self.courseId,
            "title": self.title,
            "order": self.order,
            "level": self.level,
            "duration": self.duration,
            "tags": self.tags,
            "author": self.author,
        }


@dataclass
class ParseError:
    code: str
    message: str
    recoverable: bool


@dataclass
class ParsedDocument:
    source_file: str
    meta: SlideMeta
    slides: List[SlideData]
    raw_md_hash: Optional[str] = None
    degraded: bool = False
    _auto_generated: bool = False
    error: Optional[ParseError] = None

    def to_dict(self) -> dict:
        return {
            "source_file": self.source_file,
            "raw_md_hash": self.raw_md_hash,
            "degraded": self.degraded,
            "_auto_generated": self._auto_generated,
            "meta": self.meta.to_dict(),
            "slides": [s.to_dict() for s in self.slides],
            "error": {
                "code": self.error.code,
                "message": self.error.message,
                "recoverable": self.error.recoverable,
            } if self.error else None,
        }


@dataclass
class ValidationError:
    code: str
    field: str
    message: str
    fixable: bool


@dataclass
class ValidationResult:
    ok: bool
    parsed: ParsedDocument
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class RepairRequest:
    attempt: int
    source: str
    file_info: MdFileInfo
    data: Any
    errors: List[Any]


@dataclass
class RepairResult:
    success: bool
    data: Optional[ParsedDocument]
    applied_fixes: List[str]
    error: Optional[str] = None


@dataclass
class UploadResult:
    success: bool
    source_file: str
    course_id: str
    uploaded_slide_ids: List[str]
    expected_count: int
    actual_count: int
    storage_path: Optional[str]
    fatal: bool
    raw_md_hash: Optional[str]
    error: Optional[str] = None


@dataclass
class EvaluationReport:
    source_file: str
    match: bool
    expected_count: int
    actual_db_count: int
    missing_slide_indices: List[int]
    disposition: str
    evaluated_at: str
