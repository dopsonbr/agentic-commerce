import { chromium, type Browser, type Page } from 'playwright';
import { AsyncQueue, type BrowserSession, type BridgeCommand, type BridgeResult, type StoreSnapshot } from './types.js';

const SHOP_UI_URL = process.env['SHOP_UI_URL'] || 'http://localhost:4200';
const BRIDGE_READY_TIMEOUT = 30000;
const DEFAULT_COMMAND_TIMEOUT = 10000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SessionManager {
  private sessions = new Map<string, BrowserSession>();
  private pendingCreations = new Set<string>(); // Prevent race conditions
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval for stale sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions().catch(err => {
        console.error('[SessionManager] Cleanup error:', err);
      });
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Create a new browser session with shop-ui loaded in automation mode.
   * If session already exists, it will be reused.
   */
  async createSession(sessionId: string): Promise<void> {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} already exists, reusing`);
      return;
    }

    // Prevent concurrent creation of the same session
    if (this.pendingCreations.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} creation already in progress, waiting...`);
      // Wait for the pending creation to complete
      while (this.pendingCreations.has(sessionId)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.sessions.has(sessionId)) {
        return;
      }
      throw new Error(`Session ${sessionId} creation failed`);
    }

    this.pendingCreations.add(sessionId);
    let browser: Browser | null = null;

    try {
      console.log(`[SessionManager] Creating session: ${sessionId}`);

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Suppress console messages from the page (clean demo output)
      page.on('console', () => { /* suppress */ });
      page.on('pageerror', () => { /* suppress */ });

      // Navigate to shop-ui in automation mode
      const url = `${SHOP_UI_URL}?automation=1`;
      console.log(`[SessionManager] Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait for bridge to be ready
      console.log(`[SessionManager] Waiting for bridge...`);
      await page.waitForFunction(
        () => (window as unknown as { __agentBridge?: { isReady(): boolean } }).__agentBridge?.isReady() === true,
        { timeout: BRIDGE_READY_TIMEOUT }
      );
      console.log(`[SessionManager] Bridge ready for session: ${sessionId}`);

      const session: BrowserSession = {
        browser,
        page,
        queue: new AsyncQueue(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.sessions.set(sessionId, session);
    } catch (error) {
      // Clean up browser on failure
      if (browser) {
        console.log(`[SessionManager] Cleaning up browser after failed session creation`);
        await browser.close().catch(() => {});
      }
      throw error;
    } finally {
      this.pendingCreations.delete(sessionId);
    }
  }

  /**
   * Destroy a browser session, closing the browser.
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    console.log(`[SessionManager] Destroying session: ${sessionId}`);
    await session.browser.close();
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Execute a bridge command on a session.
   * Commands are serialized through a queue to prevent race conditions.
   */
  async executeCommand(sessionId: string, command: BridgeCommand): Promise<BridgeResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: `Session not found: ${sessionId}` };
    }

    // Serialize execution through the queue
    return session.queue.enqueue(async () => {
      session.lastActivity = new Date();
      return this.executeOnPage(session.page, command);
    });
  }

  /**
   * Execute a command on a Playwright page via the automation bridge.
   */
  private async executeOnPage(page: Page, command: BridgeCommand): Promise<BridgeResult> {
    const timeout = command.timeout ?? DEFAULT_COMMAND_TIMEOUT;

    console.log(`[SessionManager] Executing command: ${command.action.type}`);

    try {
      const result = await page.evaluate(
        async ({ action, successTypes, failureTypes, timeout }) => {
          const bridge = (window as unknown as { __agentBridge?: {
            dispatchAndWait(
              action: unknown,
              successTypes: string[],
              failureTypes: string[],
              timeout: number
            ): Promise<unknown>;
          } }).__agentBridge;

          if (!bridge) {
            return { success: false, error: 'Bridge not available' };
          }
          return bridge.dispatchAndWait(action, successTypes, failureTypes, timeout);
        },
        { action: command.action, successTypes: command.successTypes, failureTypes: command.failureTypes, timeout }
      );

      console.log(`[SessionManager] Command result:`, JSON.stringify(result));
      return result as BridgeResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SessionManager] Command error:`, message);
      return { success: false, error: message };
    }
  }

  /**
   * Get current store state from a session.
   */
  async getState(sessionId: string): Promise<StoreSnapshot | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return session.queue.enqueue(async () => {
      session.lastActivity = new Date();
      return session.page.evaluate(() => {
        const bridge = (window as unknown as { __agentBridge?: {
          getState(): unknown;
        } }).__agentBridge;
        return bridge?.getState() ?? null;
      }) as Promise<StoreSnapshot | null>;
    });
  }

  /**
   * Check if a session exists.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get the number of active sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Destroy all active sessions.
   */
  async destroyAllSessions(): Promise<void> {
    // Stop the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log(`[SessionManager] Destroying all ${this.sessions.size} sessions`);
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.destroySession(id)));
  }

  /**
   * Clean up sessions that have been idle for too long.
   */
  private async cleanupStaleSessions(): Promise<void> {
    const now = Date.now();
    const staleSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivity.getTime();
      if (idleTime > SESSION_IDLE_TIMEOUT_MS) {
        staleSessionIds.push(sessionId);
      }
    }

    if (staleSessionIds.length > 0) {
      console.log(`[SessionManager] Cleaning up ${staleSessionIds.length} stale sessions`);
      await Promise.all(staleSessionIds.map(id => this.destroySession(id)));
    }
  }
}
