import { createHash } from 'node:crypto';

const WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_TRACKED = 50_000;

const seen = new Map<string, number>();

export function visitorFingerprint(ip: string, userAgent: string): string {
  return createHash('sha256').update(ip + '|' + userAgent).digest('hex');
}

export function isNewVisitor(fingerprint: string, now: number = Date.now()): boolean {
  const firstSeen = seen.get(fingerprint);
  if (firstSeen !== undefined && now - firstSeen < WINDOW_MS) {
    return false;
  }

  if (seen.size >= MAX_TRACKED) {
    pruneVisitors(now);
  }

  seen.set(fingerprint, now);
  return true;
}

export function pruneVisitors(now: number = Date.now()): void {
  for (const [fingerprint, firstSeen] of seen) {
    if (now - firstSeen >= WINDOW_MS) {
      seen.delete(fingerprint);
    }
  }
}

export function resetVisitors(): void {
  seen.clear();
}

export const VISITOR_WINDOW_MS = WINDOW_MS;
