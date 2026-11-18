import { describe, it, expect } from 'vitest';
import { isAuthAttempt } from './lib/api.js';

describe('401 on sign-in calls keeps the visitor on the page with the error', () => {
  it('treats sign-in, sign-up and reset calls as auth attempts', () => {
    expect(isAuthAttempt('/api/auth/login')).toBe(true);
    expect(isAuthAttempt('/api/auth/register')).toBe(true);
    expect(isAuthAttempt('/api/auth/reset-password')).toBe(true);
    expect(isAuthAttempt('/api/auth/forgot-password')).toBe(true);
  });
  it('still logs out on 401 from any other call (expired session)', () => {
    expect(isAuthAttempt('/api/auth/me')).toBe(false);
    expect(isAuthAttempt('/api/license/check')).toBe(false);
    expect(isAuthAttempt(undefined)).toBe(false);
  });
});
