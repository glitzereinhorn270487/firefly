// einfache Logger-Utility: newline-delimited JSON in daily-rotated files.
// optionaler Redis-Push ist als Platzhalter enthalten (LOG_TO_REDIS=false Standard).
import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = process.env.LOG_FILE_PATH || 'logs/trades.log';
const LOG_ROTATE_DAILY = (process.env.LOG_ROTATE_DAILY || 'true').toLowerCase() === 'true';
const LOG_TO_REDIS = (process.env.LOG_TO_REDIS || 'false').toLowerCase() === 'true';
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || '';
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN || '';

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function todaysLogPath(): string {
  if (!LOG_ROTATE_DAILY) return LOG_FILE_PATH;
  const dir = path.dirname(LOG_FILE_PATH);
  const base = path.basename(LOG_FILE_PATH);
  const ext = path.extname(base);
  const name = base.replace(ext, '');
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const file = `${name}-${date}${ext || '.log'}`;
  return path.join(dir, file);
}

/**
 * writeLog
 * Writes a JSON object as one newline-delimited JSON line to the log file.
 * Also attempts to push to Redis if LOG_TO_REDIS=true and UPSTASH_* env present.
 */
export async function writeLog(obj: object): Promise<void> {
  try {
    const outDir = path.dirname(todaysLogPath());
    ensureDir(outDir);
    const line = JSON.stringify(obj) + '\n';
    fs.appendFileSync(todaysLogPath(), line, { encoding: 'utf8' });

    // Optional Redis push (best-effort; placeholder implementation using REST push if env set)
    if (LOG_TO_REDIS) {
      if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
        // eslint-disable-next-line no-console
        console.warn('LOG_TO_REDIS enabled but UPSTASH_REDIS_URL/UPSTASH_REDIS_TOKEN not set.');
      } else {
        try {
          // Upstash REST API expects commands; using LPUSH via REST requires specific format.
          // Keep this best-effort to avoid adding a heavy dependency here.
          // We POST a JSON payload to the Upstash REST URL if it's configured as a simple proxy.
          await fetch(UPSTASH_REDIS_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}`
            },
            body: JSON.stringify({ key: 'trade:logs', value: line })
          }).catch(() => {
            // swallow redis errors to avoid interfering with main flow
            // eslint-disable-next-line no-console
            console.warn('Failed to push log to Upstash (best-effort).');
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Upstash push error', e);
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to write log', e);
  }
}