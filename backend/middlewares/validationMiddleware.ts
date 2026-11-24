import type { NextFunction, Request, Response } from 'express';

const ALLOWED_SLOT_RE = /^(active|slot_[1-3])$/;

export function hasUnsafeNoSqlKeys(value: unknown, depth = 0): boolean {
  if (depth > 12 || value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasUnsafeNoSqlKeys(item, depth + 1));
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) {
        return true;
      }
      if (hasUnsafeNoSqlKeys(v, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

export function sanitizeNoSqlPayload(req: Request, res: Response, next: NextFunction) {
  if (hasUnsafeNoSqlKeys(req.body) || hasUnsafeNoSqlKeys(req.query)) {
    res.status(400).json({ error: 'Invalid input keys detected.' });
    return;
  }
  next();
}

export function isValidSaveSlotId(slotId: string): boolean {
  return ALLOWED_SLOT_RE.test(slotId);
}

export function sanitizeGuestOwnerId(raw: unknown): string {
  if (typeof raw !== 'string') return 'guest_local';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  if (!cleaned.startsWith('guest_')) return 'guest_local';
  return cleaned;
}
