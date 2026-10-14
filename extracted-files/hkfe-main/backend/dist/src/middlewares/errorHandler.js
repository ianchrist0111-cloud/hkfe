"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler = (err, req, res, _next) => {
    logger_1.default.error(`Unhandled Server Error on ${req.method} ${req.path}`, err, {
        method: req.method,
        path: req.path,
        status: err.status || 500,
        ip: req.ip,
    });
    const status = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    // In production, never leak internal error messages or stack traces
    const message = isProduction && status >= 500
        ? 'An unexpected error occurred. Please try again later.'
        : (err.message || 'Internal server error');
    res.status(status).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message,
            ...(!isProduction && { stack: err.stack }),
        },
    });
};
exports.errorHandler = errorHandler;
