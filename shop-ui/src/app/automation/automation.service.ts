import { Injectable, inject, signal, OnDestroy } from '@angular/core';
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
   * Check URL params for automation mode and initialize if enabled.
   */
  private checkAutomationMode(): void {
    const params = new URLSearchParams(window.location.search);
    const isAutomation = params.get('automation') === '1';

    this.enabled.set(isAutomation);

    if (isAutomation) {
      console.log('[AgentBridge] Automation mode enabled');
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
    console.log('[AgentBridge] Bridge initialized and ready');
  }

  /**
   * Get a synchronous snapshot of the current store state.
   */
  private getStoreSnapshot(): StoreSnapshot {
    let snapshot: StoreSnapshot | undefined;

    // Synchronously get current state using first() operator
    this.store
      .select((state) => state)
      .pipe(first())
      .subscribe((state) => {
        snapshot = {
          products: {
            products: state.products?.products ?? [],
            selectedProduct: state.products?.selectedProduct ?? null,
            loading: state.products?.loading ?? false,
            error: state.products?.error ?? null,
            searchQuery: state.products?.searchQuery ?? '',
          },
          cart: {
            cart: state.cart?.cart ?? null,
            customerId: state.cart?.customerId ?? '',
            loading: state.cart?.loading ?? false,
            error: state.cart?.error ?? null,
          },
        };
      });

    return snapshot!;
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
      console.log(`[AgentBridge] Dispatching action: ${action.type}`);

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
          console.log(`[AgentBridge] Result for ${action.type}:`, result);
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
    // Check common error payload patterns
    const actionWithPayload = action as Action & {
      error?: string | { message?: string };
      payload?: { error?: string | { message?: string } };
    };

    const error =
      actionWithPayload.error ?? actionWithPayload.payload?.error;

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
      console.log('[AgentBridge] Bridge destroyed');
    }
  }
}
