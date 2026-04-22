import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from . import scanner, parser, validator, repair, uploader, evaluator
from .models import (
    MdFileInfo, ParsedDocument, ValidationResult,
    RepairRequest, UploadResult, Stage,
)

logger = logging.getLogger(__name__)

INPUTS_DIR = os.getenv("INPUTS_DIR", "./inputs")
PROCESSED_DIR = os.getenv("PROCESSED_DIR", "./processed")
QUARANTINE_DIR = os.getenv("QUARANTINE_DIR", "./quarantine")
STATE_DIR = os.getenv("STATE_DIR", "./state")
STATE_FILE = os.path.join(STATE_DIR, "pipeline_state.json")

MAX_REPAIR_ATTEMPTS = 2


class PipelineCommander:

    def __init__(self) -> None:
        self.run_id = str(uuid.uuid4())
        self.state = self._load_state()
        if not self.state.get("run_id"):
            self.state["run_id"] = self.run_id
            self.state["started_at"] = datetime.now(timezone.utc).isoformat()

    # ── State persistence ─────────────────────────────────────────────────

    def _load_state(self) -> dict:
        Path(STATE_DIR).mkdir(parents=True, exist_ok=True)
        if Path(STATE_FILE).exists():
            try:
                with open(STATE_FILE, encoding="utf-8") as f:
                    state = json.load(f)
                state.setdefault("retry_count", 0)
                state.setdefault("stats", {})
                state["stats"].setdefault("total_slides_uploaded", 0)
                state["stats"].setdefault("skipped", 0)
                return state
            except Exception as exc:
                logger.warning(f"state 로드 실패, 초기화: {exc}")
        return {
            "run_id": "",
            "started_at": "",
            "current_file": None,
            "stage": Stage.IDLE,
            "retry_count": 0,
            "processed": [],
            "quarantined": [],
            "dead_letter": [],
            "stats": {"total": 0, "success": 0, "failed": 0, "skipped": 0, "total_slides_uploaded": 0},
        }

    def _save_state(self) -> None:
        self.state["last_updated"] = datetime.now(timezone.utc).isoformat()
        Path(STATE_DIR).mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    # ── Quarantine ────────────────────────────────────────────────────────

    def _quarantine(self, file_info: MdFileInfo, reason: str, error_codes: List[str]) -> None:
        Path(QUARANTINE_DIR).mkdir(parents=True, exist_ok=True)
        src = Path(file_info.path)
        dst = Path(QUARANTINE_DIR) / file_info.name
        try:
            shutil.move(str(src), str(dst))
        except Exception as exc:
            logger.warning(f"격리 이동 실패: {exc}")

        report = {
            "source_file": file_info.name,
            "reason": reason,
            "error_codes": error_codes,
            "quarantined_at": datetime.now(timezone.utc).isoformat(),
        }
        report_path = Path(QUARANTINE_DIR) / f"{file_info.stem}_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        self.state["quarantined"].append(file_info.name)
        self.state["stats"]["failed"] += 1
        logger.error(f"QUARANTINE: {file_info.name} — {reason}")

    # ── Per-file pipeline ─────────────────────────────────────────────────

    def _process_file(self, file_info: MdFileInfo) -> bool:
        """Returns True if file was fully processed (success or quarantine)."""
        self.state["current_file"] = file_info.name
        repair_attempts = 0

        # ── PARSING ───────────────────────────────────────────────────────
        self.state["stage"] = Stage.PARSING
        self._save_state()

        doc: ParsedDocument = parser.parse(file_info)

        if doc.error and not doc.error.recoverable:
            self._quarantine(file_info, f"복구 불가 파싱 오류: {doc.error.code}", [doc.error.code])
            self.state["current_file"] = None
            self._save_state()
            return True

        if doc.error and doc.error.recoverable:
            # Try repair
            for attempt in range(1, MAX_REPAIR_ATTEMPTS + 1):
                self.state["stage"] = Stage.REPAIRING
                self._save_state()
                repair_attempts = attempt

                req = RepairRequest(
                    attempt=attempt,
                    source="parser",
                    file_info=file_info,
                    data=doc,
                    errors=[doc.error],
                )
                result = repair.repair(req)

                if result.success and result.data:
                    doc = result.data
                    break
            else:
                self._quarantine(file_info, "파싱 2회 복구 실패", [doc.error.code if doc.error else "PARSE_FAIL"])
                return True  # processed (quarantined)

        # ── VALIDATING ────────────────────────────────────────────────────
        self.state["stage"] = Stage.VALIDATING
        self._save_state()

        val_result: ValidationResult = validator.validate(doc)

        if not val_result.ok:
            fixable_errors = [e for e in val_result.errors if e.fixable]
            unfixable = [e for e in val_result.errors if not e.fixable]

            if unfixable:
                codes = [e.code for e in unfixable]
                self._quarantine(file_info, f"복구 불가 오류: {codes}", codes)
                return True

            if fixable_errors:
                for attempt in range(1, MAX_REPAIR_ATTEMPTS + 1):
                    self.state["stage"] = Stage.REPAIRING
                    self._save_state()
                    repair_attempts = attempt

                    req = RepairRequest(
                        attempt=attempt,
                        source="validator",
                        file_info=file_info,
                        data=val_result,
                        errors=fixable_errors,
                    )
                    result = repair.repair(req)

                    if result.success and result.data:
                        doc = result.data
                        # Re-validate
                        val_result = validator.validate(doc)
                        if val_result.ok:
                            break
                else:
                    codes = [e.code for e in fixable_errors]
                    self._quarantine(file_info, "검증 2회 복구 실패", codes)
                    return True

        # ── UPLOADING ─────────────────────────────────────────────────────
        self.state["stage"] = Stage.UPLOADING
        self._save_state()

        upload_result: UploadResult = uploader.upload(doc, file_content=file_info.content)

        if not upload_result.success:
            if upload_result.fatal:
                # FATAL: terminate pipeline
                self.state["dead_letter"].append(file_info.name)
                self.state["stage"] = Stage.DEAD_LETTER
                self._save_state()
                raise RuntimeError(
                    f"FATAL: {upload_result.error} — 파이프라인 중단"
                )
            else:
                logger.error(f"업로드 실패: {file_info.name} — {upload_result.error}")
                self.state["dead_letter"].append(file_info.name)
                self.state["stats"]["failed"] += 1
                return True

        # ── EVALUATING ────────────────────────────────────────────────────
        self.state["stage"] = Stage.EVALUATING
        self._save_state()

        eval_report = evaluator.evaluate(
            upload_result=upload_result,
            run_id=self.run_id,
            processed_dir=PROCESSED_DIR,
            inputs_dir=INPUTS_DIR,
            repair_attempts=repair_attempts,
        )

        if not eval_report.match and eval_report.missing_slide_indices:
            # One retry: re-upload missing slides only
            logger.warning(f"평가 불일치, 누락 슬라이드 재업로드 시도: {eval_report.missing_slide_indices}")
            missing_doc = ParsedDocument(
                source_file=doc.source_file,
                meta=doc.meta,
                slides=[s for s in doc.slides if s.index in eval_report.missing_slide_indices],
                raw_md_hash=doc.raw_md_hash,
                degraded=doc.degraded,
            )
            retry_result = uploader.upload(missing_doc)
            if retry_result.success:
                # Re-evaluate
                eval_report = evaluator.evaluate(
                    upload_result=retry_result,
                    run_id=self.run_id,
                    processed_dir=PROCESSED_DIR,
                    inputs_dir=INPUTS_DIR,
                    repair_attempts=repair_attempts,
                )

        if eval_report.disposition == "processed":
            self.state["processed"].append(file_info.name)
            self.state["stats"]["success"] += 1
            self.state["stats"]["total_slides_uploaded"] += upload_result.actual_count
            logger.info(f"완료: {file_info.name} ({upload_result.actual_count} 슬라이드)")
        else:
            logger.warning(f"manual_review: {file_info.name}")
            self.state["stats"]["failed"] += 1

        self.state["current_file"] = None
        self.state["retry_count"] = 0
        self._save_state()
        return True

    # ── Main run ──────────────────────────────────────────────────────────

    def run(self) -> dict:
        logger.info(f"=== AIX 파이프라인 시작 | run_id={self.run_id} ===")

        # ── SCANNING ──────────────────────────────────────────────────────
        self.state["stage"] = Stage.SCANNING
        self._save_state()

        file_queue: List[MdFileInfo] = scanner.scan(
            INPUTS_DIR,
            self.state.get("processed", []),
        )

        if not file_queue:
            logger.info("처리할 파일이 없습니다.")
            self.state["stage"] = Stage.DONE
            self._save_state()
            return self._final_report(0)

        self.state["stats"]["total"] += len(file_queue)
        self._save_state()

        # ── Per-file processing ────────────────────────────────────────────
        for file_info in file_queue:
            try:
                self._process_file(file_info)
            except RuntimeError as exc:
                # FATAL error
                logger.critical(str(exc))
                self.state["stage"] = Stage.TERMINATED
                self._save_state()
                report = self._final_report(len(file_queue))
                self._save_pipeline_run(report, status="terminated")
                return report

        self.state["stage"] = Stage.DONE
        self.state["current_file"] = None
        self._save_state()

        report = self._final_report(len(file_queue))
        logger.info(
            f"=== 파이프라인 완료 | 성공={report['stats']['success']} "
            f"실패={report['stats']['failed']} "
            f"격리={len(self.state['quarantined'])} ==="
        )

        # Save run report (local file + DB)
        report_path = Path(STATE_DIR) / f"run_report_{self.run_id}.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        self._save_pipeline_run(report, status="completed")

        return report

    def _save_pipeline_run(self, report: dict, status: str = "completed") -> None:
        try:
            from supabase import create_client
            client = create_client(
                os.environ["SUPABASE_URL"],
                os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            )
            stats = report.get("stats", {})
            total = stats.get("total", 0)
            success = stats.get("success", 0)
            rate = round(success / total * 100, 2) if total > 0 else 0.0
            client.table("pipeline_runs").upsert({
                "run_id": report["run_id"],
                "started_at": report["started_at"],
                "finished_at": report["finished_at"],
                "duration_seconds": None,
                "total_files": total,
                "processed": success,
                "quarantined": len(report.get("quarantined", [])),
                "dead_letter": len(report.get("dead_letter", [])),
                "skipped": stats.get("skipped", 0),
                "total_slides": stats.get("total_slides_uploaded", 0),
                "parse_success_rate": rate,
                "status": status,
            }, on_conflict="run_id").execute()
        except Exception as exc:
            logger.warning(f"pipeline_runs 저장 실패 (non-fatal): {exc}")

    def _final_report(self, total_queued: int) -> dict:
        stats = self.state["stats"]
        success = stats.get("success", 0)
        total = stats.get("total", total_queued)
        rate = round(success / total * 100, 1) if total > 0 else 0.0

        return {
            "run_id": self.run_id,
            "started_at": self.state.get("started_at"),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "stats": stats,
            "parse_success_rate": rate,
            "quarantined": self.state.get("quarantined", []),
            "dead_letter": self.state.get("dead_letter", []),
        }
