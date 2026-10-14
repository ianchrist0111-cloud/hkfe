"use strict";
// HKFES Production Structured Logger
// Emits formatted NDJSON for log aggregators (Datadog / CloudWatch / ELK) in production
// and human-readable colorized strings in development.
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const env_1 = require("../config/env");
const LEVEL_PRIORITY = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const CURRENT_LEVEL = process.env.LOG_LEVEL || (env_1.ENV.NODE_ENV === 'production' ? 'info' : 'debug');
class Logger {
    context;
    constructor(context = 'App') {
        this.context = context;
    }
    child(context) {
        return new Logger(`${this.context}:${context}`);
    }
    shouldLog(level) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[CURRENT_LEVEL];
    }
    formatEntry(level, message, metadata, err) {
        const entry = {
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
                stack: env_1.ENV.NODE_ENV === 'production' ? undefined : err.stack,
            };
        }
        return entry;
    }
    output(level, entry) {
        if (env_1.ENV.NODE_ENV === 'production') {
            // NDJSON format for production log management
            const line = JSON.stringify(entry);
            if (level === 'error') {
                process.stderr.write(line + '\n');
            }
            else {
                process.stdout.write(line + '\n');
            }
        }
        else {
            // Clean formatted development output
            const color = level === 'error' ? '\x1b[31m' :
                level === 'warn' ? '\x1b[33m' :
                    level === 'info' ? '\x1b[36m' : '\x1b[90m';
            const reset = '\x1b[0m';
            const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
            const errStr = entry.error ? ` [Error: ${entry.error.message}]` : '';
            console.log(`${color}[${entry.timestamp.slice(11, 19)}] [${level.toUpperCase()}] [${entry.context}]${reset} ${entry.message}${meta}${errStr}`);
        }
    }
    debug(message, metadata) {
        if (!this.shouldLog('debug'))
            return;
        this.output('debug', this.formatEntry('debug', message, metadata));
    }
    info(message, metadata) {
        if (!this.shouldLog('info'))
            return;
        this.output('info', this.formatEntry('info', message, metadata));
    }
    warn(message, metadata) {
        if (!this.shouldLog('warn'))
            return;
        this.output('warn', this.formatEntry('warn', message, metadata));
    }
    error(message, err, metadata) {
        if (!this.shouldLog('error'))
            return;
        const errorObj = err instanceof Error ? err : typeof err === 'string' ? new Error(err) : undefined;
        const meta = errorObj ? metadata : (err || metadata);
        this.output('error', this.formatEntry('error', message, meta, errorObj));
    }
}
exports.logger = new Logger('HKFES');
exports.default = exports.logger;
