"""AIX 파이프라인 진입점 — python run.py"""
import logging
import os
import sys

from dotenv import load_dotenv

load_dotenv()

# ── Logging setup ─────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_TO_FILE = os.getenv("LOG_TO_FILE", "false").lower() == "true"

stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", buffering=1, closefd=False)
handlers = [logging.StreamHandler(stdout)]
if LOG_TO_FILE:
    os.makedirs("./state", exist_ok=True)
    handlers.append(logging.FileHandler("./state/pipeline.log", encoding="utf-8"))

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=handlers,
)

logger = logging.getLogger(__name__)


def check_env() -> bool:
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        logger.critical(f"필수 환경변수 없음: {missing}. .env 파일을 확인하세요.")
        return False
    return True


def main() -> int:
    logger.info("AIX 지식 자산화 파이프라인 시작")

    if not check_env():
        return 1

    from pipeline.commander import PipelineCommander
    cmd = PipelineCommander()
    report = cmd.run()

    rate = report.get("parse_success_rate", 0)
    stats = report.get("stats", {})
    logger.info(
        f"최종 결과: 성공율={rate}% | "
        f"총={stats.get('total', 0)} 성공={stats.get('success', 0)} "
        f"실패={stats.get('failed', 0)} 슬라이드={stats.get('total_slides_uploaded', 0)}"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
