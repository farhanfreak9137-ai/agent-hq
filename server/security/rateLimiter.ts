import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Lightweight sliding-window in-memory rate limiter for backend endpoints.
 */
export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const records = new Map<string, RateLimitRecord>();
  const { windowMs, max, message = 'Too many requests. Please slow down.' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = records.get(ip);
    if (!record) {
      record = { timestamps: [] };
      records.set(ip, record);
    }

    // Filter out timestamps outside current window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= max) {
      res.status(429).json({
        error: message,
        retryAfterMs: windowMs - (now - record.timestamps[0]),
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
