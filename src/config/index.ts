export interface Config {
  SAMPLE_RATE: number;
  SAMPLE_BY: 'poolAddress' | 'txHash';
  PAPER_TRADING: boolean;
  RAYDIUM_FACTORY_ADDRESSES: string[];
  LOG_LEVEL: string;
  RPC_WSS?: string;
  WEBHOOK_URL?: string;
  WEBHOOK_AUTH?: string;
  MAX_GETTX_PER_SEC: number;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

/**
 * Parse a comma-separated string of addresses
 */
function parseAddressList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
}

/**
 * Parse a boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Parse a number environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate sample rate is between 0 and 1
 */
function validateSampleRate(rate: number): number {
  if (rate < 0) return 0;
  if (rate > 1) return 1;
  return rate;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const sampleRate = validateSampleRate(parseNumber(process.env.SAMPLE_RATE, 0.05));
  const sampleBy = (process.env.SAMPLE_BY === 'txHash') ? 'txHash' : 'poolAddress';
  const paperTrading = parseBoolean(process.env.PAPER_TRADING, false);
  const logLevel = process.env.LOG_LEVEL || 'info';
  const raydiumFactoryAddresses = parseAddressList(process.env.RAYDIUM_FACTORY_ADDRESSES);
  const maxGetTxPerSec = parseNumber(process.env.MAX_GETTX_PER_SEC, 5);

  return {
    SAMPLE_RATE: sampleRate,
    SAMPLE_BY: sampleBy,
    PAPER_TRADING: paperTrading,
    RAYDIUM_FACTORY_ADDRESSES: raydiumFactoryAddresses,
    LOG_LEVEL: logLevel,
    RPC_WSS: process.env.RPC_WSS,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    WEBHOOK_AUTH: process.env.WEBHOOK_AUTH,
    MAX_GETTX_PER_SEC: maxGetTxPerSec,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
  };
}

/**
 * Get a typed config instance
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset config instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}