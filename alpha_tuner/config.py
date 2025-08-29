"""
Config loader for AlphaTuner.
Supports YAML or JSON config files.
"""
from typing import Any, Dict
import json
import logging
from pathlib import Path

try:
    import yaml  # pyyaml
except Exception:  # pragma: no cover
    yaml = None

LOG = logging.getLogger(__name__)


def load_config(path: str) -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    text = p.read_text(encoding="utf8")
    if p.suffix.lower() in {".yml", ".yaml"}:
        if yaml is None:
            raise RuntimeError("PyYAML not installed. Install with `pip install pyyaml`")
        return yaml.safe_load(text)
    else:
        return json.loads(text)


def default_config() -> Dict[str, Any]:
    # Mirror the blueprint defaults
    return {
        "MIN_SCORE_TO_CONSIDER": 200,
        "MIN_SCORE_TO_EXECUTE_PAPER": 300,
        "MIN_SCORE_TO_EXECUTE_LIVE": 600,
        "MIN_SAMPLE_SIZE_FOR_DECISION": 50,
        "CONFIDENCE_PVALUE_THRESHOLD": 0.05,
        "MAX_DAILY_DRAWDOWN": 0.07,
        "MAX_CONCURRENT_POSITIONS": 5,
        "MAX_POSITION_PERCENT_OF_EQUITY": 0.02,
        "TIERED_TAKE_PROFIT_LEVELS": [0.02, 0.05, 0.10],
        "STOP_LOSS_LEVEL": 0.03,
        "TRAILING_STOP_ENABLED": False,
        "MAX_ACCEPTABLE_SLIPPAGE_USD": 10,
        "MAX_AVG_LATENCY_MS": 500,
        "MIN_WINRATE_TO_SCALE_UP": 0.55,
        "SCALE_UP_STEP": 0.1,
        "MIN_SHARPE_TO_DEPLOY_LIVE": 0.5,
        "MAX_FEES_PERCENT_OF_PNL": 0.2,
        "MIN_TIME_IN_MARKET_SECONDS": 60,
        "HISTORICAL_WINDOW_DAYS": 30,
        "CI_BOOTSTRAP_ITER": 1000,
    }
