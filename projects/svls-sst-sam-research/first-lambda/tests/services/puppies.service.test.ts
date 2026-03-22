import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPuppies } from '../../src/services/puppies.service.js';

describe('puppies.service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns a list of puppies', () => {
    const result = getPuppies();

    expect(result).to.be.an('array');
  });

});
