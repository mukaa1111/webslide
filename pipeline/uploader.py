import logging
import os
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .models import ParsedDocument, UploadResult

logger = logging.getLogger(__name__)

RETRY_MAX = int(os.getenv("UPLOAD_RETRY_MAX", "3"))
RETRY_MIN_WAIT = int(os.getenv("UPLOAD_RETRY_MIN_WAIT", "2"))
RETRY_MAX_WAIT = int(os.getenv("UPLOAD_RETRY_MAX_WAIT", "8"))


def _get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _upsert_course(client: Client, doc: ParsedDocument) -> None:
    meta = doc.meta
    client.table("courses").upsert({
        "course_id": meta.courseId,
        "title": meta.title or meta.courseId,
        "level": meta.level,
        "total_duration": meta.duration or 0,
        "is_published": True,
        "author": meta.author,
    }, on_conflict="course_id").execute()


def _upsert_tags(client: Client, course_id: str, tags: list) -> None:
    if not tags:
        return

    for tag_name in tags:
        slug = tag_name.lower().strip()
        if not slug:
            continue
        # Upsert tag
        result = client.table("tags").upsert(
            {"name": tag_name.strip(), "slug": slug},
            on_conflict="slug",
        ).execute()

        # Get tag id
        tag_result = client.table("tags").select("id").eq("slug", slug).single().execute()
        if tag_result.data:
            tag_id = tag_result.data["id"]
            # Upsert course_tag relation
            client.table("course_tags").upsert(
                {"course_id": course_id, "tag_id": tag_id},
                on_conflict="course_id,tag_id",
            ).execute()


_STORAGE_BUCKET = os.getenv("MD_BACKUP_BUCKET", "md-backups")
_STORAGE_ENABLED = os.getenv("MD_BACKUP_ENABLED", "true").lower() != "false"


def _backup_to_storage(client: Client, course_id: str, source_file: str, content: str) -> Optional[str]:
    if not _STORAGE_ENABLED:
        return None
    try:
        storage_path = f"{course_id}/{source_file}"
        client.storage.from_(_STORAGE_BUCKET).upload(
            storage_path,
            content.encode("utf-8"),
            {"content-type": "text/markdown; charset=utf-8", "upsert": "true"},
        )
        return storage_path
    except Exception as exc:
        logger.warning(f"STORAGE_UPLOAD_FAILED: {source_file} — {exc}")
        return None


@retry(
    stop=stop_after_attempt(RETRY_MAX),
    wait=wait_exponential(multiplier=1, min=RETRY_MIN_WAIT, max=RETRY_MAX_WAIT),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _upsert_slides_with_retry(client: Client, rows: list) -> list:
    result = client.table("knowledge_slides").upsert(
        rows,
        on_conflict="source_file,slide_index",
    ).execute()
    return result.data or []


def upload(doc: ParsedDocument, file_content: str = "") -> UploadResult:
    try:
        client = _get_client()
    except KeyError as exc:
        return UploadResult(
            success=False,
            source_file=doc.source_file,
            course_id=doc.meta.courseId,
            uploaded_slide_ids=[],
            expected_count=0,
            actual_count=0,
            storage_path=None,
            fatal=True,
            raw_md_hash=doc.raw_md_hash,
            error=f"UPLOAD_AUTH_ERROR: 환경변수 없음 — {exc}",
        )

    course_id = doc.meta.courseId
    expected = len(doc.slides)

    # ── Upsert course ──────────────────────────────────────────────────────
    try:
        _upsert_course(client, doc)
    except Exception as exc:
        logger.error(f"course upsert 실패: {exc}")

    # ── Upsert tags ────────────────────────────────────────────────────────
    try:
        _upsert_tags(client, course_id, doc.meta.tags)
    except Exception as exc:
        logger.warning(f"tag upsert 실패: {exc}")

    # ── Storage backup ─────────────────────────────────────────────────────
    storage_path: Optional[str] = None
    if file_content:
        storage_path = _backup_to_storage(client, course_id, doc.source_file, file_content)

    # ── Slides upsert ──────────────────────────────────────────────────────
    rows = []
    for slide in doc.slides:
        slide_dict = slide.to_dict()
        rows.append({
            "source_file": doc.source_file,
            "slide_index": slide.index,
            "course_id": course_id,
            "title": slide.title,
            "content_json": slide_dict,
            "layout": slide.layout,
            "tags": doc.meta.tags,
            "raw_md_hash": doc.raw_md_hash,
            "degraded": doc.degraded,
            "is_searchable": True,
        })

    try:
        inserted = _upsert_slides_with_retry(client, rows)
        slide_ids = [r.get("id", "") for r in inserted if r]
        actual = len(slide_ids)
    except Exception as exc:
        err_str = str(exc)
        fatal = "401" in err_str or "403" in err_str or "UPLOAD_AUTH" in err_str
        return UploadResult(
            success=False,
            source_file=doc.source_file,
            course_id=course_id,
            uploaded_slide_ids=[],
            expected_count=expected,
            actual_count=0,
            storage_path=storage_path,
            fatal=fatal,
            raw_md_hash=doc.raw_md_hash,
            error=f"UPLOAD_RETRY_EXHAUSTED: {exc}",
        )

    # ── Update course stats ────────────────────────────────────────────────
    try:
        client.rpc("update_course_stats", {"p_course_id": course_id}).execute()
    except Exception as exc:
        logger.warning(f"update_course_stats RPC 실패: {exc}")

    logger.info(f"업로드 완료: {doc.source_file} — {actual}/{expected} 슬라이드")

    return UploadResult(
        success=True,
        source_file=doc.source_file,
        course_id=course_id,
        uploaded_slide_ids=slide_ids,
        expected_count=expected,
        actual_count=actual,
        storage_path=storage_path,
        fatal=False,
        raw_md_hash=doc.raw_md_hash,
    )
