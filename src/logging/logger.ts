import pino from 'pino';

export interface LogContext {
  event?: string;
  module?: string;
  runId?: string;
  txHash?: string;
  poolAddress?: string;
  sample_decision?: 'sampled_in' | 'sampled_out';
  latency_ms?: number;
  metadata?: Record<string, any>;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

class PinoLogger implements Logger {
  private logger: pino.Logger;

  constructor(logLevel: string = 'info') {
    this.logger = pino({
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      }
    });
  }

  private buildLogObject(message: string, context?: LogContext) {
    return {
      message,
      timestamp: new Date().toISOString(),
      ...context
    };
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.buildLogObject(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.buildLogObject(message, context));
  }

  error(message: string, context?: LogContext): void {
    this.logger.error(this.buildLogObject(message, context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.buildLogObject(message, context));
  }
}

// Singleton logger instance
let loggerInstance: Logger;

/**
 * Get or create the logger instance
 */
export function getLogger(logLevel?: string): Logger {
  if (!loggerInstance) {
    loggerInstance = new PinoLogger(logLevel || process.env.LOG_LEVEL || 'info');
  }
  return loggerInstance;
}

/**
 * Create a child logger with predefined context
 */
export function createChildLogger(baseContext: LogContext, logLevel?: string): Logger {
  const baseLogger = getLogger(logLevel);
  
  return {
    info: (message: string, context?: LogContext) => 
      baseLogger.info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) => 
      baseLogger.warn(message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) => 
      baseLogger.error(message, { ...baseContext, ...context }),
    debug: (message: string, context?: LogContext) => 
      baseLogger.debug(message, { ...baseContext, ...context })
  };
}