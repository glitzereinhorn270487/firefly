"""
NDJSON log parser for AlphaTuner.

Provides:
- safe_parse_json_line(line): returns dict or None
- parse_ndjson_file(path, obj_factory=None): yields parsed objects
- dataclasses for common record types (Trade, Signal, Order, MarketSnapshot)
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any, Iterator, Callable
import json
import logging
from pathlib import Path

LOG = logging.getLogger(__name__)


def safe_parse_json_line(line: str) -> Optional[Dict[str, Any]]:
    line = line.strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        LOG.debug("Malformed JSON line skipped: %s", line)
        return None


@dataclass
class Trade:
    tradeId: str
    symbol: str
    side: str
    size: float
    entryTimestamp: int
    entryPrice: float
    exitTimestamp: Optional[int]
    exitPrice: Optional[float]
    pnlUsd: Optional[float] = None
    pnlPct: Optional[float] = None
    feesUsd: Optional[float] = None
    slippageUsd: Optional[float] = None
    finalScore: Optional[float] = None
    raw: Optional[Dict[str, Any]] = None


def trade_factory(obj: Dict[str, Any]) -> Optional[Trade]:
    # Minimal validation; return None if not enough info
    if "tradeId" not in obj or "symbol" not in obj or "entryTimestamp" not in obj:
        return None
    return Trade(
        tradeId=str(obj.get("tradeId")),
        symbol=str(obj.get("symbol")),
        side=str(obj.get("side", "")),
        size=float(obj.get("size", 0.0) or 0.0),
        entryTimestamp=int(obj.get("entryTimestamp")),
        entryPrice=float(obj.get("entryPrice", 0.0) or 0.0),
        exitTimestamp=int(obj["exitTimestamp"]) if obj.get("exitTimestamp") is not None else None,
        exitPrice=float(obj.get("exitPrice")) if obj.get("exitPrice") is not None else None,
        pnlUsd=float(obj.get("pnlUsd")) if obj.get("pnlUsd") is not None else None,
        pnlPct=float(obj.get("pnlPct")) if obj.get("pnlPct") is not None else None,
        feesUsd=float(obj.get("feesUsd")) if obj.get("feesUsd") is not None else None,
        slippageUsd=float(obj.get("slippageUsd")) if obj.get("slippageUsd") is not None else None,
        finalScore=float(obj.get("finalScore") or obj.get("score")) if (obj.get("finalScore") or obj.get("score")) is not None else None,
        raw=obj,
    )


def parse_ndjson_file(path: str, factory: Callable[[Dict[str, Any]], Optional[Any]] = trade_factory) -> Iterator[Any]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    with p.open("r", encoding="utf8") as fh:
        for line in fh:
            obj = safe_parse_json_line(line)
            if obj is None:
                continue
            item = factory(obj)
            if item is not None:
                yield item
