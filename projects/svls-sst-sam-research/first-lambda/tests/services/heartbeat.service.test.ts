import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHeartbeat } from '../../src/services/heartbeat.service.js';

describe('heartbeat.service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns an object with status, timestamp, and version', () => {
    const result = getHeartbeat();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('version');
  });

  it('returns status "ok"', () => {
    const result = getHeartbeat();

    expect(result.status).toBe('ok');
  });

  it('returns a valid ISO timestamp', () => {
    const result = getHeartbeat();
    const parsed = new Date(result.timestamp);

    expect(parsed.toISOString()).toBe(result.timestamp);
  });

  it('defaults version to "0.0.0" when SERVICE_VERSION is not set', () => {
    delete process.env.SERVICE_VERSION;
    const result = getHeartbeat();

    expect(result.version).toBe('0.0.0');
  });

  it('reads version from SERVICE_VERSION env var', () => {
    process.env.SERVICE_VERSION = '1.2.3';
    const result = getHeartbeat();

    expect(result.version).toBe('1.2.3');
  });
});
