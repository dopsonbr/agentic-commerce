import { Action } from '@ngrx/store';
import { ProductsState } from '../store/products/products.state';
import { CartState } from '../store/cart/cart.state';

/**
 * Bridge interface exposed as window.__agentBridge when automation mode is enabled.
 * Used by headless-session-manager to programmatically control the Angular app.
 */
export interface AgentBridge {
  /**
   * Check if the bridge is ready to accept commands.
   */
  isReady(): boolean;

  /**
   * Get a snapshot of the current NgRx store state.
   */
  getState(): StoreSnapshot;

  /**
   * Dispatch an NgRx action and wait for a success or failure response.
   * @param action - The action to dispatch
   * @param successTypes - Action types that indicate success
   * @param failureTypes - Action types that indicate failure
   * @param timeoutMs - Timeout in milliseconds (default: 10000)
   * @returns Promise resolving to the bridge result
   */
  dispatchAndWait(
    action: Action,
    successTypes: string[],
    failureTypes: string[],
    timeoutMs?: number
  ): Promise<BridgeResult>;
}

/**
 * Result from a dispatchAndWait operation.
 */
export interface BridgeResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The action that resolved the operation (success or failure) */
  action?: Action;
  /** Error message if the operation failed */
  error?: string;
  /** State snapshot after the operation completed */
  state?: StoreSnapshot;
}

/**
 * Snapshot of the NgRx store state.
 * Reuses existing state interfaces from store modules.
 */
export interface StoreSnapshot {
  products: ProductsState;
  cart: CartState;
}

/**
 * Root state interface for the NgRx store.
 */
export interface AppState {
  products: ProductsState;
  cart: CartState;
}

// Extend Window interface for TypeScript support
declare global {
  interface Window {
    __agentBridge?: AgentBridge;
  }
}
