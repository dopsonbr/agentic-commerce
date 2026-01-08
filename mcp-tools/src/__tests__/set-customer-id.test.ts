import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleSetCustomerId } from '../handlers/set-customer-id.js';
import { sessionStore } from '../session-context.js';
import {
  setupFetchMock,
  resetFetchMock,
  mockFetch,
  mockResponse,
} from './test-utils.js';

describe('set_customer_id handler', () => {
  beforeEach(() => {
    setupFetchMock();
    sessionStore.delete('test-session');
  });

  afterEach(() => {
    resetFetchMock();
    sessionStore.delete('test-session');
  });

  it('should store customer ID in session', async () => {
    const result = await handleSetCustomerId({ customerId: 'customer-123' }, 'test-session');

    expect(result.success).toBe(true);
    expect(result.customerId).toBe('customer-123');
    expect(sessionStore.get('test-session')?.customerId).toBe('customer-123');
  });

  it('should update existing customer ID', async () => {
    sessionStore.update('test-session', { customerId: 'old-customer' });

    await handleSetCustomerId({ customerId: 'new-customer' }, 'test-session');

    expect(sessionStore.get('test-session')?.customerId).toBe('new-customer');
  });

  it('should propagate to headless session if exists', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'headless-123' });

    let dispatchedAction: { type: string; customerId: string } | null = null;

    mockFetch('/sessions/headless-123/execute', (url, init) => {
      const body = JSON.parse(init?.body as string);
      dispatchedAction = body.action;
      return mockResponse({ success: true });
    });

    await handleSetCustomerId({ customerId: 'customer-456' }, 'test-session');

    expect(dispatchedAction).not.toBeNull();
    expect(dispatchedAction?.type).toBe('[Cart] Set Customer ID');
    expect(dispatchedAction?.customerId).toBe('customer-456');
  });

  it('should not fail if headless session does not exist', async () => {
    // No headless session set
    const result = await handleSetCustomerId({ customerId: 'customer-123' }, 'test-session');

    expect(result.success).toBe(true);
    expect(sessionStore.get('test-session')?.customerId).toBe('customer-123');
  });

  it('should not fail if headless propagation returns 404', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'stale-session' });

    mockFetch('/sessions/stale-session/execute', () =>
      mockResponse({ error: 'Session not found' }, 404)
    );

    const result = await handleSetCustomerId({ customerId: 'customer-123' }, 'test-session');

    // Should still succeed - local state is updated
    expect(result.success).toBe(true);
    expect(sessionStore.get('test-session')?.customerId).toBe('customer-123');
  });

  it('should not fail if headless propagation errors', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'broken-session' });

    mockFetch('/sessions/broken-session/execute', () =>
      mockResponse({ error: 'Internal error' }, 500)
    );

    const result = await handleSetCustomerId({ customerId: 'customer-123' }, 'test-session');

    // Should still succeed - local state is updated
    expect(result.success).toBe(true);
  });

  it('should validate input requires customerId', async () => {
    await expect(handleSetCustomerId({}, 'test-session')).rejects.toThrow();
  });

  it('should use correct action format for headless dispatch', async () => {
    sessionStore.update('test-session', { headlessSessionId: 'headless-123' });

    let capturedBody: Record<string, unknown> | null = null;

    mockFetch('/sessions/headless-123/execute', (url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return mockResponse({ success: true });
    });

    await handleSetCustomerId({ customerId: 'customer-789' }, 'test-session');

    expect(capturedBody?.successTypes).toEqual(['[Cart] Set Customer ID']);
    expect(capturedBody?.failureTypes).toEqual([]);
    expect(capturedBody?.timeout).toBe(5000);
  });

  it('should preserve other session context when updating', async () => {
    sessionStore.update('test-session', {
      cartId: 'existing-cart',
      headlessSessionId: 'existing-headless',
      customerId: null,
    });

    mockFetch('/sessions', () => mockResponse({ success: true }));

    await handleSetCustomerId({ customerId: 'new-customer' }, 'test-session');

    const context = sessionStore.get('test-session');
    expect(context?.cartId).toBe('existing-cart');
    expect(context?.headlessSessionId).toBe('existing-headless');
    expect(context?.customerId).toBe('new-customer');
  });
});
