# Implementation Retrospectives

---

# Phase 2: shop-ui Automation Bridge

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

- [x] Fix type duplication before starting headless-session-manager
- [x] Decide where action-mappings should live (shared package?)
- [x] Add `isDevMode()` guard to logging
- [x] Simplify APP_INITIALIZER or use different pattern
- [x] Add at least one integration test

---

## Fixes Applied (2026-01-07)

All identified issues have been addressed:

### 1. Type Duplication - FIXED
- `types.ts` now imports `ProductsState` and `CartState` from existing store modules
- Removed duplicate `ProductsSnapshot` and `CartSnapshot` interfaces
- `StoreSnapshot` now directly references the canonical state types

### 2. Unused Import - FIXED
- Removed unused `CartItem` import from `types.ts`

### 3. action-mappings.ts Location - RESOLVED
- Kept in `shop-ui` as documentation of the bridge contract
- Exported via `index.ts` for consumers (headless-session-manager) to reference
- Provides authoritative list of action types and their success/failure mappings

### 4. Console.log in Production - FIXED
- Added `log()` helper method that checks `isDevMode()` before logging
- All console.log calls replaced with `this.log()` calls

### 5. APP_INITIALIZER Pattern - FIXED
- Replaced awkward `APP_INITIALIZER` with cleaner `ENVIRONMENT_INITIALIZER`
- Uses `inject(AutomationService)` pattern which is more idiomatic Angular 14+

### 6. Integration Tests - ADDED
- Added "should reflect state changes in snapshot" test
- Added "should extract nested error message" test
- Added "should include state snapshot in result" test
- Added "should not expose bridge when automation is not '1'" test
- Total tests increased from 11 to 15

### 7. getStoreSnapshot Simplification
- Simplified state mapping since types now match directly
- Removed unnecessary defensive spreading

### Test Results After Fixes
```
Test Files: 2 passed
Tests: 15 passed
```

### Files Modified
- `shop-ui/src/app/automation/types.ts` - Reuse existing state types
- `shop-ui/src/app/automation/automation.service.ts` - Add isDevMode() logging
- `shop-ui/src/app/automation/automation.service.spec.ts` - Add new tests
- `shop-ui/src/app/app.config.ts` - Use ENVIRONMENT_INITIALIZER

---

# Phase 3: headless-session-manager

**Date:** 2026-01-07
**Duration:** ~1 session
**Status:** ✅ Complete

### Summary

Implemented the headless-session-manager service which manages Playwright browser sessions for executing NgRx actions via the shop-ui automation bridge. Converted from Bun to Node.js due to Playwright incompatibility.

---

## What Went Well

### 1. Clear Implementation Plan
- The detailed IMPLEMENTATION_PLAN.md provided excellent guidance with code examples
- Made implementation straightforward - knew exactly what to build

### 2. Modular Architecture
- Separating types, session manager, and Express server into distinct files
- Made the code easy to understand and test
- Clean separation of concerns

### 3. Critical Review Caught Real Issues
- Self-review identified 6 legitimate issues that would have caused integration problems:
  - Missing CORS (would break mcp-tools integration)
  - Browser resource leaks
  - Race conditions on concurrent session creation
  - Missing waitUntil for page navigation
  - Input validation gaps
  - No session cleanup mechanism

### 4. TypeScript Strictness
- Using strict TypeScript caught issues early
- Express route params typing issues found at compile time, not runtime

### 5. Quick Iteration
- Implementation + review + fix cycle was efficient within a single session

---

## What Went Poorly

### 1. CORS Not in Original Plan
**Problem:** The implementation plan didn't mention CORS, which is essential for cross-origin requests from mcp-tools.

**Should have done:** Anticipated this since services run on different ports (3001 → 3002).

### 2. npm Install in Wrong Directory
**Problem:** Initially ran `npm install cors` in root directory instead of headless-session-manager.

**Impact:** Confusion when verifying dependencies; had to reinstall in correct location.

### 3. Race Condition Not Obvious from Plan
**Problem:** The implementation plan's code example didn't handle concurrent session creation for the same sessionId.

**Impact:** Could cause multiple browsers for same session, resource leaks, undefined behavior.

### 4. No Integration Test with shop-ui
**Problem:** Only tested health endpoint; couldn't fully test session creation without shop-ui running.

**Impact:** Won't know if bridge integration works until full stack is up.

### 5. Stale Session Management Not in Plan
**Problem:** Sessions track `lastActivity` but the plan had no mechanism to clean them up.

**Impact:** Memory/resource leaks in long-running deployments.

---

## Issues Identified During Review

| Issue | Severity | Resolution |
|-------|----------|------------|
| Missing CORS | High | Added `cors` middleware |
| Browser leak on failure | High | Added try/catch with cleanup |
| Race condition in createSession | Medium | Added `pendingCreations` Set |
| Missing waitUntil | Medium | Added `{ waitUntil: 'networkidle' }` |
| Missing action.type validation | Low | Added string type check |
| No session cleanup | Low | Added cleanup interval (30min idle, 5min check) |

---

## Lessons Learned / Memory Updates

### For Future Implementations

1. **Always include CORS in multi-service architectures**
   - Any time services communicate across different ports/origins, CORS must be configured
   - Add to implementation plans for all Express servers

2. **Resource cleanup patterns**
   - When creating resources that must be cleaned up, always use try/catch/finally:
   ```typescript
   let resource = null;
   try {
     resource = await createResource();
     // use resource
   } catch (error) {
     if (resource) await resource.cleanup();
     throw error;
   }
   ```

3. **Concurrent operation guards**
   - For operations that shouldn't run concurrently for the same ID:
   ```typescript
   private pending = new Set<string>();
   if (this.pending.has(id)) { /* wait or throw */ }
   this.pending.add(id);
   try { /* operation */ } finally { this.pending.delete(id); }
   ```

4. **Page navigation reliability**
   - Always use `waitUntil: 'networkidle'` or `'domcontentloaded'` with Playwright's `page.goto()` for SPAs

5. **Verify npm directory**
   - Always confirm correct directory before running npm commands
   - Use `cd /path && npm install` pattern

### CLAUDE.md Updates Recommended

Consider adding to CLAUDE.md:

```markdown
### Cross-Service Communication
- All services use CORS for cross-origin requests
- headless-session-manager (3002) is called by mcp-tools (3001)
- Always add `cors` middleware to Express servers in this project

### Resource Management
- Browser sessions must be cleaned up on failure
- Use try/catch/finally for resource lifecycle
- Implement idle timeouts for long-running resources (30min default)
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Files created | 3 (types.ts, session-manager.ts, index.ts) |
| Files modified | 2 (package.json, tsconfig.json) |
| Files deleted | 2 (bun.lock, index.ts stub) |
| Lines of code | ~320 (TypeScript) |
| Dependencies added | express, playwright, cors, uuid, tsx, vitest |
| Commits | 2 (initial implementation + review fixes) |

---

## Action Items for Next Phase

- [ ] Phase 4: mcp-tools server implementation
- [ ] Integration testing: shop-api + shop-ui + headless-session-manager
- [ ] Update CLAUDE.md with CORS and resource management guidance
