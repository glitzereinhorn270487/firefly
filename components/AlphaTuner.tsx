'use client';
import React, { useEffect, useState } from 'react';

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

export default function AlphaTuner() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/alpha-tuner/summary')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load alpha-tuner summary', e);
        setError(e.message || 'Failed to load summary');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Alpha Tuner</h2>
        <p>Loading trade logs summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Alpha Tuner</h2>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Alpha Tuner</h2>
      <p>Aggregated logs summary from trades*.log files</p>
      
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1em' }}>Log Analysis</h3>
            <div style={{ fontSize: '0.9em', color: '#64748b' }}>
              <div>Total lines: <strong>{summary.totalLines.toLocaleString()}</strong></div>
              <div>Parsed lines: <strong>{summary.parsed.toLocaleString()}</strong></div>
              <div>Trade count: <strong>{summary.tradeCount.toLocaleString()}</strong></div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1em' }}>Performance</h3>
            <div style={{ fontSize: '0.9em', color: '#64748b' }}>
              <div>Wins: <span style={{ color: '#10b981' }}><strong>{summary.wins}</strong></span></div>
              <div>Losses: <span style={{ color: '#ef4444' }}><strong>{summary.losses}</strong></span></div>
              <div>Win Rate: <strong>{summary.wins + summary.losses > 0 ? Math.round((summary.wins / (summary.wins + summary.losses)) * 100) : 0}%</strong></div>
              <div>Avg PnL: <strong>{summary.avgPnlUsd !== null ? `$${summary.avgPnlUsd}` : 'N/A'}</strong></div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1em' }}>Timing</h3>
            <div style={{ fontSize: '0.9em', color: '#64748b' }}>
              <div>Avg Duration: <strong>{summary.avgDurationMinutes !== null ? `${summary.avgDurationMinutes} min` : 'N/A'}</strong></div>
              <div>Avg Score: <strong>{summary.avgScore !== null ? summary.avgScore.toFixed(1) : 'N/A'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Score Distribution</h3>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {Object.entries(summary.scoresHistogram).map(([range, count]) => (
              <div key={range} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9em' }}>
                <span>{range}:</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', padding: 8, background: '#f1f5f9', borderRadius: 4 }}>
          Raw JSON Data
        </summary>
        <pre style={{ 
          background: '#0f172a', 
          color: '#e6eef8', 
          padding: 16, 
          borderRadius: 8, 
          overflow: 'auto',
          fontSize: '0.8em',
          marginTop: 8
        }}>
          {summary ? JSON.stringify(summary, null, 2) : 'Loading...'}
        </pre>
      </details>
    </div>
  );
}