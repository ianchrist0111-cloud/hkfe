// HKFES Production Structured Logger
// Emits formatted NDJSON for log aggregators (Datadog / CloudWatch / ELK) in production
// and human-readable colorized strings in development.

import { ENV } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (ENV.NODE_ENV === 'production' ? 'info' : 'debug');

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private context: string;

  constructor(context = 'App') {
    this.context = context;
  }

  public child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[CURRENT_LEVEL];
  }

  private formatEntry(level: LogLevel, message: string, metadata?: Record<string, any>, err?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: ENV.NODE_ENV === 'production' ? undefined : err.stack,
      };
    }

    return entry;
  }

  private output(level: LogLevel, entry: LogEntry) {
    if (ENV.NODE_ENV === 'production') {
      // NDJSON format for production log management
      const line = JSON.stringify(entry);
      if (level === 'error') {
        process.stderr.write(line + '\n');
      } else {
        process.stdout.write(line + '\n');
      }
    } else {
      // Clean formatted development output
      const color =
        level === 'error' ? '\x1b[31m' :
        level === 'warn'  ? '\x1b[33m' :
        level === 'info'  ? '\x1b[36m' : '\x1b[90m';
      const reset = '\x1b[0m';
      const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
      const errStr = entry.error ? ` [Error: ${entry.error.message}]` : '';
      console.log(`${color}[${entry.timestamp.slice(11, 19)}] [${level.toUpperCase()}] [${entry.context}]${reset} ${entry.message}${meta}${errStr}`);
    }
  }

  public debug(message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog('debug')) return;
    this.output('debug', this.formatEntry('debug', message, metadata));
  }

  public info(message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog('info')) return;
    this.output('info', this.formatEntry('info', message, metadata));
  }

  public warn(message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog('warn')) return;
    this.output('warn', this.formatEntry('warn', message, metadata));
  }

  public error(message: string, err?: any, metadata?: Record<string, any>) {
    if (!this.shouldLog('error')) return;
    const errorObj = err instanceof Error ? err : typeof err === 'string' ? new Error(err) : undefined;
    const meta = errorObj ? metadata : (err || metadata);
    this.output('error', this.formatEntry('error', message, meta, errorObj));
  }
}

export const logger = new Logger('HKFES');
export default logger;
