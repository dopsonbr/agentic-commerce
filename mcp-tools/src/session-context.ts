import type { SessionContext } from './types.js';

const HEADLESS_URL = process.env['HEADLESS_URL'] || 'http://localhost:3002';

class SessionContextStore {
  private sessions = new Map<string, SessionContext>();

  getOrCreate(sessionId: string): SessionContext {
    let context = this.sessions.get(sessionId);
    if (!context) {
      context = {
        customerId: null,
        cartId: null,
        headlessSessionId: null,
      };
      this.sessions.set(sessionId, context);
    }
    return context;
  }

  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  update(sessionId: string, updates: Partial<SessionContext>): void {
    const context = this.getOrCreate(sessionId);
    Object.assign(context, updates);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Delete session and cleanup associated headless session if exists.
   * Returns true if the session existed and was deleted.
   */
  async deleteWithCleanup(sessionId: string): Promise<boolean> {
    const context = this.sessions.get(sessionId);
    if (!context) {
      return false;
    }

    // Cleanup headless session if it exists
    if (context.headlessSessionId) {
      try {
        await fetch(`${HEADLESS_URL}/sessions/${context.headlessSessionId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore cleanup errors - headless session may already be gone
      }
    }

    return this.sessions.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const sessionStore = new SessionContextStore();
