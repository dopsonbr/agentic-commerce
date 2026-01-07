import { Injectable, inject, signal, OnDestroy, isDevMode } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Subject, takeUntil, filter, first, race, timer, map } from 'rxjs';
import { AgentBridge, BridgeResult, StoreSnapshot, AppState } from './types';

/**
 * Service that exposes the automation bridge when ?automation=1 is present.
 * This enables headless browser sessions to programmatically control the Angular app
 * by dispatching NgRx actions and awaiting their results.
 */
@Injectable({ providedIn: 'root' })
export class AutomationService implements OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly actions$ = inject(Actions);
  private readonly destroy$ = new Subject<void>();

  /** Whether automation mode is enabled */
  private readonly enabled = signal(false);
  /** Whether the bridge is ready to accept commands */
  private readonly ready = signal(false);

  constructor() {
    this.checkAutomationMode();
  }

  /**
   * Log message only in development mode.
   */
  private log(message: string, ...args: unknown[]): void {
    if (isDevMode()) {
      console.log(`[AgentBridge] ${message}`, ...args);
    }
  }

  /**
   * Check URL params for automation mode and initialize if enabled.
   */
  private checkAutomationMode(): void {
    const params = new URLSearchParams(window.location.search);
    const isAutomation = params.get('automation') === '1';

    this.enabled.set(isAutomation);

    if (isAutomation) {
      this.log('Automation mode enabled');
      this.initBridge();
    }
  }

  /**
   * Initialize the agent bridge and expose it on window.
   */
  private initBridge(): void {
    const bridge: AgentBridge = {
      isReady: () => this.ready(),
      getState: () => this.getStoreSnapshot(),
      dispatchAndWait: (action, successTypes, failureTypes, timeoutMs = 10000) =>
        this.dispatchAndWait(action, successTypes, failureTypes, timeoutMs),
    };

    window.__agentBridge = bridge;
    this.ready.set(true);
    this.log('Bridge initialized and ready');
  }

  /**
   * Get a synchronous snapshot of the current store state.
   * NgRx store is a BehaviorSubject, so first() completes synchronously.
   */
  private getStoreSnapshot(): StoreSnapshot {
    let snapshot!: StoreSnapshot;

    this.store
      .select((state) => state)
      .pipe(first())
      .subscribe((state) => {
        // Pass through state directly since StoreSnapshot matches AppState
        snapshot = {
          products: state.products,
          cart: state.cart,
        };
      });

    return snapshot;
  }

  /**
   * Dispatch an action and wait for a success or failure response.
   * Returns a promise that resolves when a matching action is observed,
   * or rejects on timeout.
   */
  private dispatchAndWait(
    action: Action,
    successTypes: string[],
    failureTypes: string[],
    timeoutMs: number
  ): Promise<BridgeResult> {
    return new Promise((resolve) => {
      this.log(`Dispatching action: ${action.type}`);

      // Set up listeners before dispatching
      const success$ = this.actions$.pipe(
        filter((a) => successTypes.includes(a.type)),
        first(),
        map((a) => ({
          success: true as const,
          action: a,
          state: this.getStoreSnapshot(),
        }))
      );

      const failure$ = this.actions$.pipe(
        filter((a) => failureTypes.includes(a.type)),
        first(),
        map((a) => ({
          success: false as const,
          action: a,
          error: this.extractError(a),
          state: this.getStoreSnapshot(),
        }))
      );

      const timeout$ = timer(timeoutMs).pipe(
        map(() => ({
          success: false as const,
          error: `Timeout after ${timeoutMs}ms waiting for ${successTypes.join(' or ')}`,
        }))
      );

      // Race between success, failure, and timeout
      race(success$, failure$, timeout$)
        .pipe(takeUntil(this.destroy$))
        .subscribe((result) => {
          this.log(`Result for ${action.type}:`, result);
          resolve(result as BridgeResult);
        });

      // Dispatch the action
      this.store.dispatch(action);
    });
  }

  /**
   * Extract error message from action payload.
   */
  private extractError(action: Action): string {
    const actionWithPayload = action as Action & {
      error?: string | { message?: string };
      payload?: { error?: string | { message?: string } };
    };

    const error = actionWithPayload.error ?? actionWithPayload.payload?.error;

    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return error.message ?? 'Unknown error';
    }
    return 'Unknown error';
  }

  /**
   * Check if automation mode is enabled.
   */
  isEnabled(): boolean {
    return this.enabled();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (window.__agentBridge) {
      delete window.__agentBridge;
      this.log('Bridge destroyed');
    }
  }
}
