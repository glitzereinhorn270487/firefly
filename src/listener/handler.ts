import { shouldSample } from '../filters/sampling';
import { getLogger, LogContext } from '../logging/logger';
import { getConfig } from '../config';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';

const logger = getLogger();
const config = getConfig();

export interface WebhookPayload {
  eventType: string;
  signature: string;
  slot: number;
  logs: string[];
  accountKeys: string[];
  txSummary: any;
  receivedAt: string;
  runId?: string;
}

/**
 * Extract identifier for sampling based on configuration
 */
function extractIdentifier(payload: WebhookPayload): string {
  if (config.SAMPLE_BY === 'txHash') {
    return payload.signature;
  }
  
  // For poolAddress, we need to extract from the event context
  // For Raydium events, look for pool-like addresses in accountKeys
  if (payload.eventType === 'raydium_pool_initialize' && payload.accountKeys.length > 0) {
    // Use the first account key as pool identifier for Raydium initialize
    return payload.accountKeys[0];
  }
  
  // Fallback to signature if no pool address can be determined
  return payload.signature;
}

/**
 * Check if payload matches configured Raydium factory addresses
 */
function matchesFactoryFilter(payload: WebhookPayload): boolean {
  if (config.RAYDIUM_FACTORY_ADDRESSES.length === 0) {
    return true; // No filter configured, allow all
  }
  
  // Check if any of the account keys match the configured factory addresses
  return payload.accountKeys.some(key => 
    config.RAYDIUM_FACTORY_ADDRESSES.includes(key)
  );
}

/**
 * Process incoming webhook with sampling logic
 */
export async function handleWebhookWithSampling(
  payload: WebhookPayload,
  forwardFunction: (payload: WebhookPayload) => Promise<void>
): Promise<{ processed: boolean; sampled: boolean; runId: string }> {
  const runId = randomUUID();
  const startTime = Date.now();

  // Add runId to payload
  const enrichedPayload = { ...payload, runId };

  const logContext: LogContext = {
    event: 'webhook.received',
    module: 'handler',
    runId,
    txHash: payload.signature,
    metadata: {
      eventType: payload.eventType,
      slot: payload.slot
    }
  };

  logger.info('Webhook received', logContext);

  try {
    // Apply factory address filter first
    if (!matchesFactoryFilter(enrichedPayload)) {
      logger.debug('Event filtered out by factory address', {
        ...logContext,
        event: 'webhook.factory_filtered',
        metadata: {
          ...logContext.metadata,
          configuredAddresses: config.RAYDIUM_FACTORY_ADDRESSES,
          payloadAddresses: payload.accountKeys
        }
      });
      return { processed: false, sampled: false, runId };
    }

    // Extract identifier for sampling
    const identifier = extractIdentifier(enrichedPayload);
    const shouldProcess = shouldSample(identifier, config.SAMPLE_RATE);

    if (!shouldProcess) {
      // Log sampled-out event and return early (lightweight processing)
      const latency = Date.now() - startTime;
      logger.info('Event sampled out', {
        ...logContext,
        event: 'webhook.sampled_out',
        sample_decision: 'sampled_out',
        latency_ms: latency,
        metadata: {
          ...logContext.metadata,
          identifier,
          sampleRate: config.SAMPLE_RATE,
          sampleBy: config.SAMPLE_BY
        }
      });
      return { processed: false, sampled: false, runId };
    }

    // Event is sampled in - continue with processing
    logger.info('Event sampled in', {
      ...logContext,
      event: 'webhook.sampled_in',
      sample_decision: 'sampled_in',
      metadata: {
        ...logContext.metadata,
        identifier,
        sampleRate: config.SAMPLE_RATE,
        sampleBy: config.SAMPLE_BY
      }
    });

    // Forward to existing pipeline
    await forwardFunction(enrichedPayload);

    const latency = Date.now() - startTime;
    logger.info('Event processed successfully', {
      ...logContext,
      event: 'webhook.processed',
      latency_ms: latency,
      sample_decision: 'sampled_in'
    });

    return { processed: true, sampled: true, runId };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Event processing failed', {
      ...logContext,
      event: 'webhook.error',
      latency_ms: latency,
      metadata: {
        ...logContext.metadata,
        error: errorMessage
      }
    });

    throw error;
  }
}

/**
 * Default webhook forwarding function
 */
export async function defaultWebhookForward(payload: WebhookPayload): Promise<void> {
  const { WEBHOOK_URL, WEBHOOK_AUTH } = config;
  
  if (!WEBHOOK_URL) {
    logger.warn('No WEBHOOK_URL configured, skipping forward', {
      event: 'webhook.no_url',
      runId: payload.runId
    });
    return;
  }

  const body = JSON.stringify(payload);
  
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_AUTH ? { Authorization: WEBHOOK_AUTH } : {}),
      },
      body,
    });
    
    if (!res.ok) {
      const responseText = await res.text();
      logger.warn('Webhook forward failed', {
        event: 'webhook.forward_failed',
        runId: payload.runId,
        metadata: {
          status: res.status,
          response: responseText
        }
      });
    } else {
      logger.debug('Webhook forwarded successfully', {
        event: 'webhook.forwarded',
        runId: payload.runId
      });
    }
  } catch (err) {
    logger.error('Webhook forward error', {
      event: 'webhook.forward_error',
      runId: payload.runId,
      metadata: {
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    });
    throw err;
  }
}