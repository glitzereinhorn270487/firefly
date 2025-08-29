// Minimal Alpha-Tuner API endpoints for summary + recommendations.
// Integrates with newline-delimited JSON logs in logs/ (rotated files).
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const LOG_DIR = path.dirname(process.env.LOG_FILE_PATH || 'logs/trades.log');

type Summary = {
  totalLines: number;
  parsed: number;
  tradeCount: number;
  wins: number;
  losses: number;
  avgPnlUsd: number | null;
  avgDurationMinutes: number | null;
  avgScore: number | null;
  scoresHistogram: Record<string, number>;
};

function safeParse(line: string): any | null {
  try {
    if (!line || line.trim() === '') return null;
    return JSON.parse(line);
  } catch {
    return null;
  }
}

router.get('/summary', async (req, res) => {
  try {
    const files = fs.existsSync(LOG_DIR)
      ? fs.readdirSync(LOG_DIR).filter((f) => f.startsWith('trades') && f.endsWith('.log'))
      : [];

    let totalLines = 0;
    let parsed = 0;
    let tradeCount = 0;
    let wins = 0;
    let losses = 0;
    let pnlSum = 0;
    let durationSumMins = 0;
    let durationCount = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    const histogram: Record<string, number> = {
      '0-199': 0,
      '200-399': 0,
      '400-599': 0,
      '600-799': 0,
      '800-1000': 0
    };

    for (const f of files) {
      const content = fs.readFileSync(path.join(LOG_DIR, f), 'utf8');
      const lines = content.split(/\r?\n/);
      totalLines += lines.length;
      for (const line of lines) {
        const obj = safeParse(line);
        if (!obj) continue;
        parsed++;
        // heuristics: treat each log line with entryTimestamp as a trade record
        if (obj.entryTimestamp) tradeCount++;
        if (typeof obj.pnlUsd === 'number') {
          pnlSum += obj.pnlUsd;
          if (obj.pnlUsd > 0) wins++;
          else losses++;
        }
        if (obj.entryTimestamp && obj.exitTimestamp) {
          durationSumMins += (obj.exitTimestamp - obj.entryTimestamp) / 60000;
          durationCount++;
        }
        if (obj.finalScore || obj.score) {
          const s = obj.finalScore || obj.score;
          scoreSum += s;
          scoreCount++;
          if (s < 200) histogram['0-199']++;
          else if (s < 400) histogram['200-399']++;
          else if (s < 600) histogram['400-599']++;
          else if (s < 800) histogram['600-799']++;
          else histogram['800-1000']++;
        }
      }
    }

    const avgPnl = parsed ? pnlSum / Math.max(1, tradeCount) : null;
    const avgDuration = durationCount ? durationSumMins / durationCount : null;
    const avgScore = scoreCount ? scoreSum / scoreCount : null;

    const summary: Summary = {
      totalLines,
      parsed,
      tradeCount,
      wins,
      losses,
      avgPnlUsd: avgPnl === null ? null : Number(avgPnl.toFixed(2)),
      avgDurationMinutes: avgDuration === null ? null : Number(avgDuration.toFixed(2)),
      avgScore: avgScore === null ? null : Number(avgScore.toFixed(2)),
      scoresHistogram: histogram
    };

    res.json(summary);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Alpha-tuner summary error', e);
    res.status(500).json({ error: 'failed to compute summary' });
  }
});

router.post('/recommendations', async (req, res) => {
  // Minimal placeholder: analyze posted range or full logs and return simple adjustments.
  // For now, return a canned response; the Alpha-Tuner engine will be expanded in subsequent commits.
  const rec = {
    suggestions: [
      { param: 'MIN_SCORE_TO_CONSIDER', change: +50, reason: 'Low win-rate for low-score trades' },
      { param: 'MIN_SCORE_TO_EXECUTE_PAPER', change: +50, reason: 'Conservative raise during paper-mode tuning' }
    ],
    explanation: 'Initial heuristic recommendations. Upload larger sample for finer recommendations.'
  };
  res.json(rec);
});

export default router;