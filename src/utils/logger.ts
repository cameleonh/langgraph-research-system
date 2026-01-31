/**
 * Logger utility for the LangGraph Research System
 * Provides consistent logging with different levels and formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colorize?: boolean;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: LogLevel.INFO,
  prefix: '',
  timestamp: true,
  colorize: true,
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.dim,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
};

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

export class Logger {
  private options: LoggerOptions;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.options.level;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const parts: string[] = [];

    if (this.options.timestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`${COLORS.dim}${timestamp}${COLORS.reset}`);
    }

    const levelColor = this.options.colorize ? LEVEL_COLORS[level] : '';
    const levelName = LEVEL_NAMES[level];
    const resetColor = this.options.colorize ? COLORS.reset : '';
    parts.push(`${levelColor}[${levelName}]${resetColor}`);

    if (this.options.prefix) {
      parts.push(`${COLORS.cyan}${this.options.prefix}${COLORS.reset}`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  private formatMeta(meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) {
      return '';
    }
    return `\n  ${COLORS.dim}${JSON.stringify(meta, null, 2)}${COLORS.reset}`;
  }

  debug(message: string, meta?: Record<string, unknown>, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, ...args) + this.formatMeta(meta), ...args);
    }
  }

  info(message: string, meta?: Record<string, unknown>, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, ...args) + this.formatMeta(meta), ...args);
    }
  }

  warn(message: string, meta?: Record<string, unknown>, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, ...args) + this.formatMeta(meta), ...args);
    }
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let errorMsg = this.formatMessage(LogLevel.ERROR, message, ...args);

      if (error instanceof Error) {
        errorMsg += `\n  ${COLORS.red}${error.message}${COLORS.reset}`;
        if (error.stack) {
          errorMsg += `\n  ${COLORS.dim}${error.stack}${COLORS.reset}`;
        }
      } else if (error) {
        errorMsg += `\n  ${COLORS.red}${String(error)}${COLORS.reset}`;
      }

      errorMsg += this.formatMeta(meta);
      console.error(errorMsg, ...args);
    }
  }

  /**
   * Create a child logger with an additional prefix
   */
  child(prefix: string): Logger {
    const newPrefix = this.options.prefix ? `${this.options.prefix}:${prefix}` : prefix;
    return new Logger({ ...this.options, prefix: newPrefix });
  }

  /**
   * Update the log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Set the log level from a string
   */
  setLevelFromString(level: string): void {
    const upperLevel = level.toUpperCase();
    switch (upperLevel) {
      case 'DEBUG':
        this.options.level = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.options.level = LogLevel.INFO;
        break;
      case 'WARN':
        this.options.level = LogLevel.WARN;
        break;
      case 'ERROR':
        this.options.level = LogLevel.ERROR;
        break;
      default:
        this.warn(`Unknown log level: ${level}, using INFO`);
        this.options.level = LogLevel.INFO;
    }
  }
}

/**
 * Create a logger instance from configuration
 */
export function createLogger(prefix?: string, level?: string): Logger {
  const logLevel = level || process.env.LOG_LEVEL || 'info';
  const logger = new Logger({ prefix });
  logger.setLevelFromString(logLevel);
  return logger;
}

/**
 * Default logger instance
 */
export const logger = createLogger();

export default logger;
