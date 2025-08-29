import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const LOG_DIR = path.dirname(process.env.LOG_FILE_PATH || 'logs/trades.log');
    
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

    return NextResponse.json(summary);
  } catch (e) {
    console.error('Alpha-tuner summary error', e);
    return NextResponse.json(
      { error: 'failed to compute summary' },
      { status: 500 }
    );
  }
}