# Codex Plan — Proposed Fixes

## Goals
- Restore correct cart behavior for the demo by aligning StoreSnapshot shape and cart ID propagation.
- Make session reset truly reset the system (UI + server + headless).
- Remove documentation drift.

## Plan
1) **Align StoreSnapshot and cartId propagation**
   - Update `headless-session-manager/src/types.ts` and `mcp-tools/src/types.ts` to match actual shop-ui store shapes:
     - `products.products` (not `items`)
     - `cart.cart` with `id` inside (not `cart.id`)
   - Update `mcp-tools/src/handlers/add-to-cart.ts` to read `result.state.cart.cart?.id` (or equivalent) instead of `result.state.cart.id`.
   - Acceptance: after `add_to_cart`, a subsequent `get_cart` returns the cart contents without a manual refresh or out-of-band state.

2) **Wire chat reset to delete sessions**
   - Add a lightweight `deleteSession(sessionId)` call in `chat-ui/src/services/mcp-client.ts` to `DELETE /sessions/:id`.
   - Call this from `resetSession` in `chat-ui/src/hooks/useChat.ts`.
   - Acceptance: clicking reset clears chat state and the server session (headless session cleaned up via mcp-tools).

3) **Update documentation drift**
   - Update `CLAUDE.md` to reflect chat-ui as implemented (not a stub).
   - Acceptance: top-level docs match current status.

## Optional (Future)
- Reduce N+1 requests in `get_cart` by caching product lookups or adding a batch endpoint in `shop-api`.
- Consider explicit session creation per tab to improve multi-tab UX.
