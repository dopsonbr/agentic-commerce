import { chromium, type Browser, type Page } from 'playwright';
import { AsyncQueue, type BrowserSession, type BridgeCommand, type BridgeResult, type StoreSnapshot } from './types.js';

const SHOP_UI_URL = process.env['SHOP_UI_URL'] || 'http://localhost:4200';
const BRIDGE_READY_TIMEOUT = 30000;
const DEFAULT_COMMAND_TIMEOUT = 10000;

export class SessionManager {
  private sessions = new Map<string, BrowserSession>();

  /**
   * Create a new browser session with shop-ui loaded in automation mode.
   * If session already exists, it will be reused.
   */
  async createSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} already exists, reusing`);
      return;
    }

    console.log(`[SessionManager] Creating session: ${sessionId}`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Navigate to shop-ui in automation mode
    const url = `${SHOP_UI_URL}?automation=1`;
    console.log(`[SessionManager] Navigating to: ${url}`);
    await page.goto(url);

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
    console.log(`[SessionManager] Destroying all ${this.sessions.size} sessions`);
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.destroySession(id)));
  }
}
