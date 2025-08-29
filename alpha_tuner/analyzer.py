"""
Simple analyzer that computes aggregate statistics from parsed Trade objects.
This is intentionally lightweight: it computes the summary fields needed by the original API.
"""
from typing import Iterable, Dict, Any, List
from .parser import Trade
import math
import statistics
import logging

LOG = logging.getLogger(__name__)


def compute_trade_summary(trades: Iterable[Trade]) -> Dict[str, Any]:
    trades_list: List[Trade] = list(trades)
    total = len(trades_list)
    trade_count = sum(1 for t in trades_list if t.entryTimestamp is not None)
    wins = sum(1 for t in trades_list if t.pnlUsd is not None and t.pnlUsd > 0)
    losses = sum(1 for t in trades_list if t.pnlUsd is not None and t.pnlUsd <= 0)
    pnl_vals = [t.pnlUsd for t in trades_list if t.pnlUsd is not None]
    avg_pnl = float(statistics.mean(pnl_vals)) if pnl_vals else None
    durations = [(t.exitTimestamp - t.entryTimestamp) / 60000.0 for t in trades_list if t.entryTimestamp and t.exitTimestamp]
    avg_duration = float(statistics.mean(durations)) if durations else None
    scores = [t.finalScore for t in trades_list if t.finalScore is not None]
    avg_score = float(statistics.mean(scores)) if scores else None

    # Score histogram with fixed buckets as blueprint
    histogram = {"0-199": 0, "200-399": 0, "400-599": 0, "600-799": 0, "800-1000": 0}
    for s in scores:
        if s < 200:
            histogram["0-199"] += 1
        elif s < 400:
            histogram["200-399"] += 1
        elif s < 600:
            histogram["400-599"] += 1
        elif s < 800:
            histogram["600-799"] += 1
        else:
            histogram["800-1000"] += 1

    summary = {
        "totalTrades": total,
        "tradeCount": trade_count,
        "wins": wins,
        "losses": losses,
        "avgPnlUsd": round(avg_pnl, 2) if avg_pnl is not None else None,
        "avgDurationMinutes": round(avg_duration, 2) if avg_duration is not None else None,
        "avgScore": round(avg_score, 2) if avg_score is not None else None,
        "scoresHistogram": histogram,
    }
    return summary
