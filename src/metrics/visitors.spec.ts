import {
  isNewVisitor,
  resetVisitors,
  VISITOR_WINDOW_MS,
  visitorFingerprint,
} from './visitors';

describe('visitors', () => {
  beforeEach(() => resetVisitors());

  it('counts the same IP and browser only once per window', () => {
    const fingerprint = visitorFingerprint('10.0.0.1', 'Firefox');

    expect(isNewVisitor(fingerprint)).toBe(true);
    expect(isNewVisitor(fingerprint)).toBe(false);
  });

  it('treats a different browser from the same IP as a new visitor', () => {
    expect(isNewVisitor(visitorFingerprint('10.0.0.1', 'Firefox'))).toBe(true);
    expect(isNewVisitor(visitorFingerprint('10.0.0.1', 'Chrome'))).toBe(true);
  });

  it('treats the same browser from a different IP as a new visitor', () => {
    expect(isNewVisitor(visitorFingerprint('10.0.0.1', 'Firefox'))).toBe(true);
    expect(isNewVisitor(visitorFingerprint('10.0.0.2', 'Firefox'))).toBe(true);
  });

  it('counts a returning visitor again once the window has elapsed', () => {
    const fingerprint = visitorFingerprint('10.0.0.1', 'Firefox');
    const start = Date.now();

    expect(isNewVisitor(fingerprint, start)).toBe(true);
    expect(isNewVisitor(fingerprint, start + VISITOR_WINDOW_MS - 1)).toBe(false);
    expect(isNewVisitor(fingerprint, start + VISITOR_WINDOW_MS)).toBe(true);
  });

  it('does not leak fingerprints across different visitors', () => {
    expect(visitorFingerprint('10.0.0.1', 'Firefox')).not.toContain('10.0.0.1');
  });
});