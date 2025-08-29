"""
Lightweight recommendation generator (stub).
Uses simple heuristics to produce recommendation objects matching the blueprint.
A full implementation should replace heuristics with statistical tests / ML models.
"""
from typing import Dict, Any, List
import time
import logging

LOG = logging.getLogger(__name__)


def generate_recommendations(summary: Dict[str, Any], config: Dict[str, Any]) -> List[Dict[str, Any]]:
    recs = []
    ts = int(time.time() * 1000)
    wins = summary.get("wins", 0)
    losses = summary.get("losses", 0)
    trade_count = summary.get("tradeCount", 0)
    avg_score = summary.get("avgScore", None) or 0.0
    winrate = (wins / trade_count) if trade_count > 0 else 0.0

    # Heuristic 1: if avg_score below MIN_SCORE_TO_EXECUTE_PAPER, suggest increase
    min_paper = config.get("MIN_SCORE_TO_EXECUTE_PAPER", 300)
    if avg_score < min_paper and trade_count >= config.get("MIN_SAMPLE_SIZE_FOR_DECISION", 50):
        recs.append({
            "id": f"rec_score_raise_{ts}",
            "timestamp": ts,
            "type": "PARAMETER_CHANGE",
            "target": "MIN_SCORE_TO_EXECUTE_PAPER",
            "currentValue": min_paper,
            "suggestedValue": int(max(min_paper, avg_score + 50)),
            "confidence": 0.6,
            "supportingStats": {
                "sampleSize": trade_count,
                "avgScore": avg_score
            },
            "recommendedAction": "review_and_apply_if_ok",
            "explanation": "Average model score is below configured MIN_SCORE_TO_EXECUTE_PAPER; consider increasing to reduce low-score trades."
        })

    # Heuristic 2: low winrate -> recommend more conservative thresholds
    min_winrate = config.get("MIN_WINRATE_TO_SCALE_UP", 0.55)
    if trade_count >= config.get("MIN_SAMPLE_SIZE_FOR_DECISION", 50) and winrate < min_winrate:
        recs.append({
            "id": f"rec_winrate_{ts}",
            "timestamp": ts,
            "type": "RISK",
            "target": "MAX_POSITION_PERCENT_OF_EQUITY",
            "currentValue": config.get("MAX_POSITION_PERCENT_OF_EQUITY"),
            "suggestedValue": max(0.001, config.get("MAX_POSITION_PERCENT_OF_EQUITY") * 0.8),
            "confidence": 0.7,
            "supportingStats": {"sampleSize": trade_count, "winrate": winrate},
            "recommendedAction": "review_and_apply_if_ok",
            "explanation": "Observed winrate below target. Reduce position sizing until performance recovers."
        })

    # Always include an explanation summary
    if not recs:
        recs.append({
            "id": f"rec_no_change_{ts}",
            "timestamp": ts,
            "type": "NO_CHANGE",
            "explanation": "No strong heuristics triggered; more data or advanced analysis required.",
            "supportingStats": {"sampleSize": trade_count}
        })

    return recs
