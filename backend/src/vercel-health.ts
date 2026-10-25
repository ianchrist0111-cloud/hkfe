import type { Request, Response } from 'express';

export default function handler(_req: Request, res: Response) {
  return res.status(200).json({
    status: 'ok',
    message: 'Vercel function is running',
    timestamp: new Date().toISOString(),
  });
}
