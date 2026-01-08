# Codex Findings — Agentic Commerce (Local Demo)

## Project Context (per answers)
- Scope: strictly local demo.
- Headless browser is a short-term bridge to a future server-side orchestration layer.
- Chat UI is scripted for now (no LLM).
- Desired: shop-ui (NgRx) and shop-api states should eventually be in sync.
- Multi-tab / multi-window support is desirable but can be deferred.

## Architecture Summary (as implemented)
- Local-first monorepo: `shop-api` (Bun), `shop-ui` (Angular + NgRx), `headless-session-manager` (Node + Playwright), `mcp-tools` (Bun tool server), `chat-ui` (React scripted chat).
- Stateless reads: chat → mcp-tools → shop-api.
- Stateful actions: chat → mcp-tools → headless-session-manager → shop-ui (NgRx effects) → shop-api.

## What’s Good
- Clear separation between UI, tools, API, and automation; responsibilities are easy to trace.
- Tool contracts are explicit and validated (Zod), which aids deterministic demos.
- Headless session queuing avoids race conditions and keeps browser state consistent per session.
- POC is genuinely local-first and repeatable, with documented startup order.

## Issues / Risks (ordered by severity)
1) **Cart ID never propagates after `add_to_cart`**
   - Impact: `get_cart` returns empty even after successful add; demo breaks for core flow.
   - Root cause: headless/mcp `StoreSnapshot` shape assumes `cart.id` / `products.items`, but shop-ui uses `cart.cart` and `products.products`.
   - Files:
     - `mcp-tools/src/handlers/add-to-cart.ts:85`
     - `mcp-tools/src/types.ts:77`
     - `headless-session-manager/src/types.ts:28`
     - `shop-ui/src/app/store/cart/cart.state.ts:3`
     - `shop-ui/src/app/store/products/products.state.ts:3`

2) **Session reset is UI-only**
   - Impact: chat resets don’t clear server/headless state; stale sessions linger until idle cleanup.
   - Files:
     - `chat-ui/src/hooks/useChat.ts:176`
     - `mcp-tools/src/index.ts:70`

3) **Docs drift: chat-ui listed as stub**
   - Impact: confusing for contributors; suggests missing work that’s already done.
   - File: `CLAUDE.md:38`

4) **N+1 product enrichment in `get_cart`**
   - Impact: for larger carts, latency scales linearly (acceptable for demo, but noted).
   - File: `mcp-tools/src/handlers/get-cart.ts:47`

## Fit vs Stated Goals
- The current design matches a local demo and scripted chat constraint.
- The “headless as bridge” strategy aligns with short-term objectives, but the snapshot shape mismatch undermines correctness.
- Multi-tab support would benefit from robust session creation and explicit session lifecycle controls (partially present, but not wired from chat-ui).

## Recommendations (aligned with demo goals)
- Fix StoreSnapshot shape and cartId propagation so add_to_cart → get_cart works reliably.
- Wire chat reset to delete sessions in mcp-tools (and cascading to headless). This keeps the demo clean and repeatable.
- Update documentation to reflect chat-ui’s current status.
- (Optional) Reduce N+1 fetches in `get_cart` by caching product data or adding a batch endpoint in shop-api.

## Open Questions (for later, given current scope)
- Do you want a single shared “source of truth” for cart state in the demo, or is “eventual sync” sufficient?
- For multi-tab support, should tabs share a session or create isolated sessions?
