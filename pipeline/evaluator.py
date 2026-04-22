import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from supabase import create_client, Client

from .models import UploadResult, EvaluationReport

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _db_count(client: Client, source_file: str) -> int:
    result = (
        client.table("knowledge_slides")
        .select("id", count="exact")
        .eq("source_file", source_file)
        .execute()
    )
    return result.count or 0


def _get_missing_indices(client: Client, source_file: str, expected_indices: list) -> list:
    result = (
        client.table("knowledge_slides")
        .select("slide_index")
        .eq("source_file", source_file)
        .execute()
    )
    stored = {r["slide_index"] for r in (result.data or [])}
    return [i for i in expected_indices if i not in stored]


def _log_pipeline(client: Client, run_id: str, upload: UploadResult,
                  disposition: str, repair_attempts: int = 0) -> None:
    try:
        client.table("pipeline_log").insert({
            "run_id": run_id,
            "source_file": upload.source_file,
            "course_id": upload.course_id,
            "slide_count": upload.actual_count,
            "disposition": disposition,
            "repair_attempts": repair_attempts,
            "raw_md_hash": upload.raw_md_hash,
        }).execute()
    except Exception as exc:
        logger.warning(f"pipeline_log 기록 실패: {exc}")


def evaluate(
    upload_result: UploadResult,
    run_id: str,
    processed_dir: str,
    inputs_dir: str,
    repair_attempts: int = 0,
) -> EvaluationReport:
    now = datetime.now(timezone.utc).isoformat()

    try:
        client = _get_client()
    except Exception as exc:
        logger.error(f"evaluator DB 연결 실패: {exc}")
        return EvaluationReport(
            source_file=upload_result.source_file,
            match=False,
            expected_count=upload_result.expected_count,
            actual_db_count=0,
            missing_slide_indices=list(range(upload_result.expected_count)),
            disposition="manual_review",
            evaluated_at=now,
        )

    actual = _db_count(client, upload_result.source_file)
    expected = upload_result.expected_count

    if actual == expected:
        # Move file to /processed
        src = Path(inputs_dir) / upload_result.source_file
        dst = Path(processed_dir) / upload_result.source_file
        try:
            Path(processed_dir).mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            logger.info(f"파일 이동: {upload_result.source_file} → /processed")
        except Exception as exc:
            logger.warning(f"파일 이동 실패: {exc}")

        _log_pipeline(client, run_id, upload_result, "processed", repair_attempts)

        return EvaluationReport(
            source_file=upload_result.source_file,
            match=True,
            expected_count=expected,
            actual_db_count=actual,
            missing_slide_indices=[],
            disposition="processed",
            evaluated_at=now,
        )

    # Count mismatch — find missing indices
    expected_indices = upload_result.uploaded_slide_ids  # may be empty on partial
    try:
        missing = _get_missing_indices(
            client,
            upload_result.source_file,
            list(range(expected)),
        )
    except Exception:
        missing = list(range(expected))

    logger.warning(
        f"EVAL 불일치: {upload_result.source_file} — "
        f"expected={expected}, actual={actual}, missing={missing}"
    )

    _log_pipeline(client, run_id, upload_result, "manual_review", repair_attempts)

    return EvaluationReport(
        source_file=upload_result.source_file,
        match=False,
        expected_count=expected,
        actual_db_count=actual,
        missing_slide_indices=missing,
        disposition="manual_review",
        evaluated_at=now,
    )
