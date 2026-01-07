# ImplementationPlan.md

# Implementation Plan — Entire System (Local-First POC)

This plan is intentionally high-level and optimized for running everything on a single developer machine.

---

## Phase 0 — Local Scaffold + Repo Layout (0.5–1 day)
- Ensure each app can run locally with minimal config:
  - `shop-api`
  - `shop-ui`
  - `headless-session-manager`
  - `mcp-tools`
  - `chat-ui`
- Define local ports and base URLs
- Add a simple root-level “runbook” (how to start everything locally)

Deliverable: all apps start locally (even if mocked).

---

## Phase 1 — Tool Contracts + UI Event Model (1–2 days)
- Define:
  - tool schemas (inputs/outputs)
  - chat event model (assistant_message, tool_call, tool_result, status)
- Implement a minimal end-to-end “tool card” rendering path:
  - `chat-ui` can invoke a mock tool in `mcp-tools` and render results

Deliverable: chat shows structured tool results with no headless yet.

---

## Phase 2 — shop-ui Automation Bridge (1–2 days)
- Add automation mode toggle to `shop-ui`:
  - query param `?automation=1`
- Implement `window.__agentBridge`:
  - `dispatchAndWait(action, okTypes, errTypes, correlationId)`
- Ensure “add to cart” has:
  - explicit success/failure actions
  - correlationId propagation (if needed for determinism)

Deliverable: the SPA can be controlled programmatically in a reliable way.

---

## Phase 3 — Headless Session Manager (2–4 days)
- Implement:
  - one headless session per chat session
  - per-session execution queue (serialization)
  - load `shop-ui?automation=1`
  - wait for bridge ready
- Add basic diagnostics:
  - screenshot on error
  - console error capture

Deliverable: a stable local headless runner that can dispatch NGRX actions.

---

## Phase 4 — mcp-tools Routing (2–3 days)
- Implement tools (POC minimum):
  - `search_products` (direct to `shop-api`)
  - `add_to_cart` (via headless session manager + NGRX dispatch)
  - `get_cart_summary` (direct to `shop-api` or snapshot via bridge)
- Ensure `mcp-tools` maintains a 1:1 mapping between:
  - chat session id
  - headless session id

Deliverable: tools work end-to-end against local services.

---

## Phase 5 — chat-ui POC Experience (1–3 days)
- Implement the “Chat + Context Panel” layout:
  - conversation feed with tool cards
  - cart summary panel
  - shortlist panel (optional)
- Add approvals for impactful actions:
  - add_to_cart approval gate
- Implement “scripted agent mode” OR “operator mode” for zero-cost demo control

Deliverable: stakeholders can use the chat UI to drive real cart changes locally.

---

## Phase 6 — Demo Hardening + Local Runbook (1–2 days)
- Add “Reset session” controls (recreate headless session)
- Improve failure feedback:
  - auth expired
  - headless not ready
  - tool timeout
- Produce a clean local runbook:
  - startup order
  - environment variables
  - demo script (“search → shortlist → approve add_to_cart → cart update”)

Deliverable: stable, repeatable local demo.

---

## Phase 7 (Optional) — Swap in “Smarter Brain” without Paid APIs
- Keep the same tool/event protocol
- Add:
  - local LLM adapter (Ollama/LM Studio) OR
  - lightweight rules improvements
- Ensure the demo remains deterministic by keeping approvals + tool cards

Deliverable: more natural language, same tool-driven backbone.

---

## System-Level Acceptance Criteria (Local POC)
- All 5 apps run locally and communicate correctly
- One headless browser per chat session stays warm and processes multiple tool calls
- `add_to_cart` reliably completes via NGRX success/failure signals
- `chat-ui` renders tool calls/results in a trustworthy way
- Demo can be run repeatedly on a dev machine without paid AI services
