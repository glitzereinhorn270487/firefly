/**
 * Upstash Redis REST API client
 * Provides simple get/set operations via HTTP REST interface
 */

interface UpstashConfig {
  url: string;
  token: string;
}

/**
 * Get Upstash configuration from environment variables
 */
function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return { url, token };
}

/**
 * Execute a Redis command via Upstash REST API
 */
async function executeCommand(command: string[]): Promise<any> {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error('Upstash Redis configuration not found');
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { result: any };
  return data.result;
}

/**
 * Get a value from Redis
 */
export async function redisGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const result = await executeCommand(['GET', key]);
    if (result === null) {
      return undefined;
    }
    
    // Try to parse as JSON, fall back to string if it fails
    try {
      return JSON.parse(result);
    } catch {
      return result as T;
    }
  } catch (error) {
    console.warn('Redis GET failed:', error);
    return undefined;
  }
}

/**
 * Set a value in Redis
 */
export async function redisSet<T = any>(key: string, value: T): Promise<void> {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await executeCommand(['SET', key, serialized]);
  } catch (error) {
    console.warn('Redis SET failed:', error);
    // Don't throw to maintain compatibility with volatile store behavior
  }
}

/**
 * Check if Upstash Redis is configured and available
 */
export function isRedisAvailable(): boolean {
  return getUpstashConfig() !== null;
}