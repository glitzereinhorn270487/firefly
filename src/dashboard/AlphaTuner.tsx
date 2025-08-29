import React, { useEffect, useState } from 'react';

export default function AlphaTuner() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    fetch('/api/alpha-tuner/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch((e) => console.error('Failed to load alpha-tuner summary', e));
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h2>Alpha Tuner (Minimal)</h2>
      <p>Aggregated logs summary from logs/*.log</p>
      <pre style={{ background: '#0f172a', color: '#e6eef8', padding: 12 }}>
        {summary ? JSON.stringify(summary, null, 2) : 'Loading...'}
      </pre>
    </div>
  );
}