import type { SessionContext } from './types.js';

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

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const sessionStore = new SessionContextStore();
