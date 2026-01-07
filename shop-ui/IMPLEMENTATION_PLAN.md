# shop-ui Implementation Plan: Automation Bridge

This plan details adding the automation bridge to enable programmatic control of the Angular SPA via headless browser sessions.

## Overview

The automation bridge exposes `window.__agentBridge` when the app is loaded with `?automation=1`. This allows the headless-session-manager to dispatch NgRx actions and await their results.

## Prerequisites

- Working shop-ui with NgRx store (products + cart) ✅
- Understanding of existing NgRx actions and effects

## Dependencies

None - this is the first implementation step after defining tool contracts.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           shop-ui                                   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                       NgRx Store                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │ │
│  │  │  Products   │  │    Cart     │  │   Session   │           │ │
│  │  │   State     │  │   State     │  │   State     │           │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │ │
│  │         │                │                │                   │ │
│  │         └────────────────┼────────────────┘                   │ │
│  │                          │                                    │ │
│  │                          ▼                                    │ │
│  │  ┌───────────────────────────────────────────────────────┐   │ │
│  │  │              AutomationService                         │   │ │
│  │  │  • Detects ?automation=1                               │   │ │
│  │  │  • Subscribes to action stream                         │   │ │
│  │  │  • Exposes window.__agentBridge                        │   │ │
│  │  └───────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  window.__agentBridge                                               │
│  ├── isReady(): boolean                                             │
│  ├── getState(): StoreSnapshot                                      │
│  └── dispatchAndWait(action, successTypes, failureTypes): Promise   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create TypeScript Types

**File:** `src/app/automation/types.ts`

```typescript
import { Action } from '@ngrx/store';

export interface AgentBridge {
  isReady(): boolean;
  getState(): StoreSnapshot;
  dispatchAndWait(
    action: Action,
    successTypes: string[],
    failureTypes: string[],
    timeoutMs?: number
  ): Promise<BridgeResult>;
}

export interface BridgeResult {
  success: boolean;
  action?: Action;
  error?: string;
  state?: StoreSnapshot;
}

export interface StoreSnapshot {
  products: {
    items: Product[];
    loading: boolean;
    error: string | null;
  };
  cart: {
    id: string | null;
    customerId: string | null;
    items: CartItem[];
    loading: boolean;
    error: string | null;
  };
}

// Extend Window interface
declare global {
  interface Window {
    __agentBridge?: AgentBridge;
  }
}
```

### Step 2: Create Automation Service

**File:** `src/app/automation/automation.service.ts`

```typescript
import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { Subject, takeUntil, filter, first, race, timer, map } from 'rxjs';
import { AgentBridge, BridgeResult, StoreSnapshot } from './types';

@Injectable({ providedIn: 'root' })
export class AutomationService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly destroy$ = new Subject<void>();

  private readonly enabled = signal(false);
  private readonly ready = signal(false);

  constructor() {
    this.checkAutomationMode();
  }

  private checkAutomationMode(): void {
    const params = new URLSearchParams(window.location.search);
    const isAutomation = params.get('automation') === '1';

    this.enabled.set(isAutomation);

    if (isAutomation) {
      console.log('[AgentBridge] Automation mode enabled');
      this.initBridge();
    }
  }

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

  private getStoreSnapshot(): StoreSnapshot {
    let snapshot: StoreSnapshot | undefined;

    // Synchronously get current state
    this.store.select(state => state).pipe(first()).subscribe(state => {
      snapshot = {
        products: {
          items: state.products?.items ?? [],
          loading: state.products?.loading ?? false,
          error: state.products?.error ?? null,
        },
        cart: {
          id: state.cart?.id ?? null,
          customerId: state.cart?.customerId ?? null,
          items: state.cart?.items ?? [],
          loading: state.cart?.loading ?? false,
          error: state.cart?.error ?? null,
        },
      };
    });

    return snapshot!;
  }

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
        filter(a => successTypes.includes(a.type)),
        first(),
        map(a => ({ success: true, action: a, state: this.getStoreSnapshot() }))
      );

      const failure$ = this.actions$.pipe(
        filter(a => failureTypes.includes(a.type)),
        first(),
        map(a => ({ success: false, action: a, error: this.extractError(a), state: this.getStoreSnapshot() }))
      );

      const timeout$ = timer(timeoutMs).pipe(
        map(() => ({ success: false, error: `Timeout after ${timeoutMs}ms` }))
      );

      // Race between success, failure, and timeout
      race(success$, failure$, timeout$)
        .pipe(takeUntil(this.destroy$))
        .subscribe(result => {
          console.log(`[AgentBridge] Result:`, result);
          resolve(result as BridgeResult);
        });

      // Dispatch the action
      this.store.dispatch(action);
    });
  }

  private extractError(action: Action): string {
    // Extract error from action payload if present
    const payload = (action as any).error ?? (action as any).payload?.error;
    return payload?.message ?? payload ?? 'Unknown error';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (window.__agentBridge) {
      delete window.__agentBridge;
    }
  }
}
```

### Step 3: Register Service in App Config

**File:** `src/app/app.config.ts` (modify existing)

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { AutomationService } from './automation/automation.service';
// ... existing imports

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers

    // Initialize automation service on app start
    {
      provide: 'AUTOMATION_INIT',
      useFactory: (automation: AutomationService) => automation,
      deps: [AutomationService],
    },
  ],
};
```

### Step 4: Define Action Mappings

**File:** `src/app/automation/action-mappings.ts`

```typescript
/**
 * Maps high-level operations to their NgRx action types.
 * Used by headless-session-manager to know which actions to await.
 */
export const ACTION_MAPPINGS = {
  addToCart: {
    trigger: '[Cart] Add Item',
    success: ['[Cart] Add Item Success'],
    failure: ['[Cart] Add Item Failure'],
  },
  removeFromCart: {
    trigger: '[Cart] Remove Item',
    success: ['[Cart] Remove Item Success'],
    failure: ['[Cart] Remove Item Failure'],
  },
  updateCartItem: {
    trigger: '[Cart] Update Item Quantity',
    success: ['[Cart] Update Item Quantity Success'],
    failure: ['[Cart] Update Item Quantity Failure'],
  },
  loadCart: {
    trigger: '[Cart] Load Cart',
    success: ['[Cart] Load Cart Success'],
    failure: ['[Cart] Load Cart Failure'],
  },
  loadProducts: {
    trigger: '[Products] Load Products',
    success: ['[Products] Load Products Success'],
    failure: ['[Products] Load Products Failure'],
  },
} as const;

export type ActionMappingKey = keyof typeof ACTION_MAPPINGS;
```

### Step 5: Update Cart Actions (if needed)

Ensure cart actions have proper success/failure variants. Check `src/app/store/cart/cart.actions.ts`:

```typescript
import { createAction, props } from '@ngrx/store';
import { CartItem } from '../../models/cart.model';

// Add Item
export const addItem = createAction(
  '[Cart] Add Item',
  props<{ sku: string; quantity: number }>()
);

export const addItemSuccess = createAction(
  '[Cart] Add Item Success',
  props<{ item: CartItem }>()
);

export const addItemFailure = createAction(
  '[Cart] Add Item Failure',
  props<{ error: string }>()
);

// Similar patterns for other cart operations...
```

---

## File Structure

```
src/app/automation/
├── types.ts              # TypeScript interfaces
├── automation.service.ts # Main service
└── action-mappings.ts    # Action type mappings
```

---

## Testing

### Manual Testing

1. Start shop-ui: `npm start`
2. Navigate to: `http://localhost:4200?automation=1`
3. Open browser console
4. Verify: `window.__agentBridge.isReady()` returns `true`
5. Test dispatch:
```javascript
window.__agentBridge.dispatchAndWait(
  { type: '[Products] Load Products' },
  ['[Products] Load Products Success'],
  ['[Products] Load Products Failure'],
  5000
).then(console.log)
```

### Unit Tests

**File:** `src/app/automation/automation.service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject } from 'rxjs';
import { AutomationService } from './automation.service';

describe('AutomationService', () => {
  let service: AutomationService;
  let actions$: Subject<any>;

  beforeEach(() => {
    actions$ = new Subject();

    // Mock URL with automation param
    Object.defineProperty(window, 'location', {
      value: { search: '?automation=1' },
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        AutomationService,
        provideMockStore({ initialState: { products: { items: [] }, cart: { items: [] } } }),
        provideMockActions(() => actions$),
      ],
    });

    service = TestBed.inject(AutomationService);
  });

  it('should expose bridge when automation=1', () => {
    expect(window.__agentBridge).toBeDefined();
    expect(window.__agentBridge?.isReady()).toBe(true);
  });

  it('should resolve on success action', async () => {
    const promise = window.__agentBridge!.dispatchAndWait(
      { type: '[Cart] Add Item', sku: '100001', quantity: 1 },
      ['[Cart] Add Item Success'],
      ['[Cart] Add Item Failure'],
      1000
    );

    // Emit success action
    actions$.next({ type: '[Cart] Add Item Success', item: { sku: '100001' } });

    const result = await promise;
    expect(result.success).toBe(true);
  });
});
```

---

## Acceptance Criteria

- [ ] `?automation=1` enables automation mode
- [ ] `window.__agentBridge` is exposed
- [ ] `isReady()` returns `true` after initialization
- [ ] `getState()` returns current store snapshot
- [ ] `dispatchAndWait()` resolves on success action
- [ ] `dispatchAndWait()` rejects on failure action
- [ ] `dispatchAndWait()` times out if no response
- [ ] Console logs aid debugging

---

## Integration Points

### With headless-session-manager

The headless-session-manager will:
1. Navigate to `http://localhost:4200?automation=1`
2. Wait for `window.__agentBridge?.isReady()` to return `true`
3. Call `dispatchAndWait()` to execute actions
4. Read results and state snapshots

### Example Playwright Usage

```typescript
// In headless-session-manager
await page.goto('http://localhost:4200?automation=1');
await page.waitForFunction(() => window.__agentBridge?.isReady() === true);

const result = await page.evaluate(async () => {
  return window.__agentBridge!.dispatchAndWait(
    { type: '[Cart] Add Item', sku: '100003', quantity: 1 },
    ['[Cart] Add Item Success'],
    ['[Cart] Add Item Failure'],
    10000
  );
});

console.log(result); // { success: true, action: {...}, state: {...} }
```
