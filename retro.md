# Agentic Commerce Retrospectives

## Phase 5 — Chat UI (2026-01-08)

### What Went Well

1. **Implementation plan was comprehensive and accurate**
   - The detailed step-by-step plan with code examples made implementation straightforward
   - File structure and component breakdown was well-thought-out
   - Pattern matching examples in the plan translated directly to working code

2. **Existing infrastructure was solid**
   - mcp-tools API was well-documented and worked as expected
   - CORS was already configured (lesson from Phase 4 retro)
   - Session management patterns were already established

3. **Incremental improvements over plan**
   - Added auto-scroll for better UX
   - Added session reset functionality
   - Added quick tips panel for user guidance
   - Added tool args display for debugging visibility

4. **Unit tests caught real bugs**
   - Tests discovered pattern matching priority issue ("show my cart" → search instead of cart)
   - Tests found regex capture issue ("search for X" captured "for X")
   - Testing forced explicit extraction of business logic for better testability

5. **TypeScript caught issues early**
   - Type checking identified null safety issues before runtime
   - Strict typing ensured API contract compliance

### What Went Wrong

1. **Pattern matching order bug**
   - Plan didn't consider that pattern order matters for disambiguation
   - "show my cart" matched search_products before get_cart
   - **Root cause**: Patterns were added in logical grouping order, not priority order

2. **Regex complexity**
   - Original search pattern tried to handle too many variations in one regex
   - "search for X" vs "search X" needed separate patterns
   - **Root cause**: Over-engineering regex to avoid duplication

3. **Plan had a bug in cart state handling**
   - Plan showed `setCart(result as GetCartResult)` for both add_to_cart and get_cart
   - AddToCartResult has different shape than GetCartResult
   - **Root cause**: Copy-paste in plan without verifying type compatibility

4. **Missing emojis from plan**
   - Plan showed emojis in UI (🔧, 🛒, 📋) but implementation omitted them
   - Minor but shows plan-to-implementation drift
   - **Root cause**: Not using plan as exact specification

### Action Items for Next Phase

1. **Test pattern matching early**
   - Write pattern matching tests BEFORE implementing the full UI
   - Test edge cases and ambiguous inputs
   - Consider pattern priority explicitly in design

2. **Validate type shapes across services**
   - When plan references API contracts, verify actual response shapes
   - Don't assume similar-sounding operations have compatible types
   - Add type assertions at service boundaries

3. **Implement in order of testability**
   - Start with pure business logic (patterns, state updates)
   - Add React wrapper after logic is tested
   - Keeps tests simple and fast

4. **Add integration test checklist**
   - Document manual test flow in plan
   - Run through test script before marking complete
   - Consider adding automated E2E tests for Phase 6

---

## Patterns to Carry Forward

### Pattern Matching Design
```typescript
// Order patterns by specificity - most specific first
const patterns = [
  // Exact/specific matches first
  { match: /show\s+(?:my\s+)?cart/i, tool: 'get_cart' },
  // Generic matches last
  { match: /show\s+(.+)/i, tool: 'search_products' },
];
```

### Cart State Update Pattern
```typescript
// Handle different result types explicitly, don't assume shape compatibility
case 'add_to_cart': {
  const r = result as AddToCartResult;
  // Build GetCartResult from AddToCartResult manually
  setCart(prev => mergeAddResult(prev, r));
}
case 'get_cart': {
  const r = result as GetCartResult;
  setCart(r); // Direct assignment OK - types match
}
```

### Test-Driven Pattern Development
```typescript
// Write test first
test('matches "show my cart"', () => {
  expect(processMessage('show my cart', ctx).tool).toBe('get_cart');
});

// Then implement pattern
{ match: /show\s+(?:my\s+)?cart/i, tool: 'get_cart' }
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Files created | 15 |
| Lines of code | ~800 |
| Unit tests | 51 |
| Bugs found by tests | 2 |
| Time to first working UI | ~30 min |
| Time to complete with tests | ~60 min |

---

## Phase 6 Recommendations

1. **Focus on integration testing**
   - All services running together
   - End-to-end user flows
   - Error scenario handling

2. **Add loading/error states**
   - What happens when mcp-tools is down?
   - Network timeout handling
   - Retry logic for transient failures

3. **Consider adding**
   - Keyboard shortcuts
   - Message history persistence
   - Multiple session support
