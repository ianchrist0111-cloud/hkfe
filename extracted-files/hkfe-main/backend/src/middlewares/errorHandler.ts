import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`Unhandled Server Error on ${req.method} ${req.path}`, err, {
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
