import pino from 'pino';

/**
 * Logger interface with structured logging methods
 */
export interface Logger {
  /** Log an info level message */
  info(event: string, data?: object): void;
  /** Log a warning level message */
  warn(event: string, data?: object): void;
  /** Log an error level message */
  error(event: string, data?: object): void;
  /** Log a debug level message */
  debug(event: string, data?: object): void;
}

// Base Pino logger instance
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

/**
 * Creates a logger instance with consistent structured logging format.
 * All log messages include: timestamp (ISO), event, module, runId, and any additional data.
 * 
 * @param moduleName - Name of the module creating the logger (optional)
 * @returns Logger instance with structured logging methods
 * 
 * @example
 * ```typescript
 * const logger = getLogger('sampling');
 * logger.info('sample_decision', { identifier: 'user123', sampled: true });
 * logger.error('processing_failed', { error: 'Invalid input', requestId: 'req-456' });
 * ```
 */
export function getLogger(moduleName?: string): Logger {
  const module = moduleName || 'unknown';
  const runId = process.env.PAPER_RUN_ID || 'default-run';

  return {
    info(event: string, data?: object): void {
      const logData = {
        event,
        module,
        runId,
        ...data
      };
      baseLogger.info(logData);
    },

    warn(event: string, data?: object): void {
      const logData = {
        event,
        module,
        runId,
        ...data
      };
      baseLogger.warn(logData);
    },

    error(event: string, data?: object): void {
      const logData = {
        event,
        module,
        runId,
        ...data
      };
      baseLogger.error(logData);
    },

    debug(event: string, data?: object): void {
      const logData = {
        event,
        module,
        runId,
        ...data
      };
      baseLogger.debug(logData);
    }
  };
}