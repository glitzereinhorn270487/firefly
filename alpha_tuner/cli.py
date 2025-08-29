"""
CLI entrypoint for AlphaTuner.
Commands:
  - summary: compute and print trade summary from an NDJSON file
  - recommendations: compute recommendations (based on summary + config)
"""
import argparse
import json
import logging
from pathlib import Path
from .config import load_config, default_config
from .parser import parse_ndjson_file
from .analyzer import compute_trade_summary
from .recommender import generate_recommendations

LOG = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(prog="alpha_tuner", description="AlphaTuner CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_summary = sub.add_parser("summary", help="Compute trade summary from NDJSON trades file")
    p_summary.add_argument("trades_file", type=str, help="Path to NDJSON trades log")
    p_summary.add_argument("--config", type=str, default=None, help="Optional config YAML/JSON")
    p_summary.add_argument("--pretty", action="store_true", help="Pretty-print JSON")

    p_rec = sub.add_parser("recommendations", help="Generate recommendations from trades file")
    p_rec.add_argument("trades_file", type=str, help="Path to NDJSON trades log")
    p_rec.add_argument("--config", type=str, default=None, help="Optional config YAML/JSON")
    p_rec.add_argument("--pretty", action="store_true", help="Pretty-print JSON")

    args = parser.parse_args()

    # load config
    if args.config:
        cfg = load_config(args.config)
    else:
        cfg = default_config()

    trades_path = Path(args.trades_file)
    if not trades_path.exists():
        LOG.error("Trades file not found: %s", trades_path)
        raise SystemExit(2)

    trades = list(parse_ndjson_file(str(trades_path)))
    summary = compute_trade_summary(trades)

    if args.cmd == "summary":
        out = {"generatedAt": None, "summary": summary}
        if args.pretty:
            print(json.dumps(out, indent=2))
        else:
            print(json.dumps(out))
    elif args.cmd == "recommendations":
        recs = generate_recommendations(summary, cfg)
        out = {"generatedAt": None, "summary": summary, "recommendations": recs}
        if args.pretty:
            print(json.dumps(out, indent=2))
        else:
            print(json.dumps(out))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
