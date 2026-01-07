# Implementation Retrospective: shop-ui Automation Bridge

**Date:** 2026-01-07
**Scope:** shop-ui automation bridge implementation (Phase 2 of IMPLEMENTATION_PLAN.md)

---

## What Went Well

### 1. Implementation Plan Adherence
- Followed the detailed implementation plan closely
- Created all required files as specified
- Implemented the correct API surface (`isReady`, `getState`, `dispatchAndWait`)

### 2. Test Coverage
- All 11 tests pass
- Good coverage of happy path, error cases, and timeout scenarios
- Tests validate the core contract

### 3. Build Verification
- TypeScript compilation succeeds with no errors
- Build produces valid output

### 4. Clean Separation of Concerns
- Types, mappings, and service logic are properly separated
- Index file provides clean exports
- Good JSDoc documentation

### 5. Correct State Shape
- Unlike the implementation plan example (which used `products.items`), correctly identified actual state uses `products.products`
- Properly matched the existing `ProductsState` and `CartState` interfaces

---

## What Went Poorly

### 1. Type Duplication (DRY Violation)
**Problem:** Created `ProductsSnapshot` and `CartSnapshot` interfaces that duplicate `ProductsState` and `CartState` from the existing store modules.

**Should have done:**
```typescript
// types.ts
import { ProductsState } from '../store/products/products.state';
import { CartState } from '../store/cart/cart.state';

export interface StoreSnapshot {
  products: ProductsState;
  cart: CartState;
}
```

**Impact:** Maintenance burden - if store state changes, two places need updating.

### 2. Unused Import
**Problem:** `CartItem` is imported in `types.ts` but never used.

### 3. action-mappings.ts Not Integrated
**Problem:** Created `action-mappings.ts` with comprehensive mappings, but the `AutomationService` doesn't use it. The file exists but provides no value to the current implementation.

**Should have done:** Either:
- Integrate action-mappings into the service as a helper
- Move it to a shared location for headless-session-manager
- Remove it from shop-ui scope (it's really for the consumer)

### 4. Non-Null Assertion Code Smell
**Problem:** In `getStoreSnapshot()`:
```typescript
return snapshot!;
```
Relies on NgRx store being a BehaviorSubject (synchronous first emission). This is an implementation detail that could break.

**Better approach:**
```typescript
private getStoreSnapshot(): StoreSnapshot {
  let snapshot: StoreSnapshot;
  this.store.pipe(take(1)).subscribe(state => {
    snapshot = this.mapStateToSnapshot(state);
  });
  return snapshot; // TypeScript will complain - handle properly
}
```

### 5. Console.log in Production Code
**Problem:** Multiple `console.log` statements will appear in production builds.

**Should have done:**
```typescript
private log(message: string, ...args: unknown[]): void {
  if (isDevMode()) {
    console.log(`[AgentBridge] ${message}`, ...args);
  }
}
```

### 6. APP_INITIALIZER Pattern is Awkward
**Problem:** The current pattern:
```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (automation: AutomationService) => () => automation,
  deps: [AutomationService],
  multi: true,
}
```
Returns the service itself, which is unusual. APP_INITIALIZER expects a function that returns void or Promise<void>.

**Better approaches:**
- Inject AutomationService in AppComponent constructor (simpler)
- Use `ENVIRONMENT_INITIALIZER` (Angular 14+)
- Have the factory call an init method: `useFactory: (a: AutomationService) => () => a.init()`

### 7. No Integration Test
**Problem:** Only unit tests with mocked store/actions. No test that verifies:
- Real NgRx effects work with the bridge
- Actual action dispatch triggers effects
- State updates correctly after effects complete

### 8. Test Location Mock is Fragile
**Problem:** Mocking `window.location` via `Object.defineProperty` can fail in some environments and doesn't restore cleanly.

**Better approach:** Use Angular's DOCUMENT token or create a LocationService that can be mocked.

---

## Changes Before Next Implementation

### Must Fix Before Proceeding

1. **Remove type duplication** - Import and use existing `ProductsState` and `CartState` directly

2. **Fix or remove action-mappings.ts** - Either integrate it or move to shared package

3. **Add environment check for logging** - Use `isDevMode()` to conditionally log

4. **Fix APP_INITIALIZER pattern** - Use simpler injection or proper initializer

### Should Fix

5. **Remove unused CartItem import**

6. **Add integration test** - Test with real NgRx store, not mocks

7. **Improve location mocking in tests** - Use injectable service

### Nice to Have

8. **Add error handling for edge cases**:
   - What if dispatchAndWait is called before bridge is ready?
   - What if same action type is in both success and failure arrays?

9. **Consider adding correlation IDs** - Track specific action dispatches

---

## Lessons Learned

1. **Read existing code before writing new types** - Would have avoided the duplication if I'd checked store state files first and imported from them

2. **Question the implementation plan** - The plan had outdated/incorrect state shape (`items` vs `products`). Should verify plan against actual code.

3. **Create files only when needed** - action-mappings.ts may belong in headless-session-manager, not shop-ui

4. **Integration tests for cross-cutting concerns** - Automation bridges need real integration tests, not just unit tests with mocks

5. **Production readiness checklist** - Should have a checklist: no console.log, proper error handling, no non-null assertions

---

## Action Items for Next Phase

- [ ] Fix type duplication before starting headless-session-manager
- [ ] Decide where action-mappings should live (shared package?)
- [ ] Add `isDevMode()` guard to logging
- [ ] Simplify APP_INITIALIZER or use different pattern
- [ ] Add at least one integration test
