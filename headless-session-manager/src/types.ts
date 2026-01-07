import type { Browser, Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  page: Page;
  queue: AsyncQueue;
  createdAt: Date;
  lastActivity: Date;
}

export interface BridgeCommand {
  action: {
    type: string;
    [key: string]: unknown;
  };
  successTypes: string[];
  failureTypes: string[];
  timeout?: number;
}

export interface BridgeResult {
  success: boolean;
  action?: Record<string, unknown>;
  error?: string;
  state?: StoreSnapshot;
}

export interface StoreSnapshot {
  products: {
    items: unknown[];
    loading: boolean;
    error: string | null;
  };
  cart: {
    id: string | null;
    customerId: string | null;
    items: unknown[];
    loading: boolean;
    error: string | null;
  };
}

export interface CreateSessionRequest {
  sessionId: string;
}

export interface ExecuteCommandRequest {
  action: BridgeCommand['action'];
  successTypes: string[];
  failureTypes: string[];
  timeout?: number;
}

/**
 * Simple async queue for serializing requests per session.
 * Ensures that concurrent requests to the same browser session
 * are executed one at a time to prevent race conditions.
 */
export class AsyncQueue {
  private queue: Promise<void> = Promise.resolve();

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    let result!: T;
    let error: Error | null = null;

    this.queue = this.queue
      .then(async () => {
        try {
          result = await fn();
        } catch (e) {
          error = e instanceof Error ? e : new Error(String(e));
        }
      })
      .catch(() => {
        // Prevent unhandled rejection from breaking the queue
      });

    await this.queue;

    if (error) {
      throw error;
    }

    return result;
  }
}
