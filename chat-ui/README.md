# chat-ui/README.md

# Agentic Shopping Chat UI (POC)

This app is an internal-facing chat experience that demonstrates “agentic shopping” on top of an existing Angular + NGRX shopping SPA and existing REST APIs.

The Chat UI does **not** need a paid AI API for the POC. It supports:
- **Scripted agent mode** (deterministic flows)
- **Operator mode** (human-in-the-loop demo control)
- Later: plug-in an LLM (local or paid) without changing the UI contract

---

## Goals (POC)
- Provide a chat interface that can:
  - search products
  - propose options
  - add items to cart (via tools)
  - show cart state updates as structured “tool results”
- Make tool usage **auditable** (tool calls + tool results displayed as cards)
- Keep it safe: require user approval before impactful actions (e.g., add-to-cart, checkout)

## Non-goals (POC)
- Rebuild the full shopping SPA UX
- Replace NGRX orchestration with server-side workflows
- Perfect AI reasoning quality

---

## UX Overview (High-level)
Layout: **Chat + Context Panel**

1) **Conversation Feed**
- User + assistant messages
- “Tool event cards” for tool calls/results (no raw JSON by default)

2) **Composer**
- send message
- optional quick actions (e.g., “Show cart”, “Add top pick”)

3) **Right Rail Context Panel**
- Cart summary (items, qty, subtotal, warnings)
- Shortlist (candidate products)
- Activity (recent tool calls/results)

4) **Approval Moments**
- “Proposed action → Approve / Cancel”
- For POC, default approvals for:
  - add_to_cart
  - remove_from_cart
  - checkout (if implemented)

---

## How it Works
The Chat UI talks to an **MCP Tool Server** over HTTP/WebSocket (implementation choice), using a simple event protocol:

### Event types
- `user_message`
- `assistant_message`
- `tool_call` (name + args)
- `tool_result` (structured JSON + status)
- `system_status` (headless session ready, auth expired, etc.)

The “brain” that decides what tool to call can be:
- Scripted rules engine (POC default)
- Operator mode (a human chooses tool calls)
- Later: local LLM / paid LLM

---

## Integration Points
- **MCP Tool Server** (required)
  - accepts user messages / tool invocations
  - returns tool results and assistant responses

- **Existing APIs** (indirect)
  - read-only calls may be routed directly by MCP
  - cart/workflow actions may be routed to headless SPA session by MCP

---

## Configuration
Example environment variables (names are suggestions):
- `CHAT_MCP_BASE_URL` — base URL for MCP Tool Server
- `CHAT_MODE` — `scripted | operator` (default: scripted)
- `CHAT_SESSION_TTL_MINUTES` — used for client UX status (server remains source of truth)
- `CHAT_ENABLE_APPROVALS` — `true|false` (default true)

---

## Local Development (suggested)
1) Run MCP Tool Server
2) Run Chat UI
3) Login via internal SSO (or dev bypass if available)

The UI should display:
- connection status to MCP
- headless session readiness (if exposed by MCP)

---

## Testing (POC)
- Unit test:
  - message rendering
  - tool card rendering
  - approval flows
- E2E (optional):
  - “search → shortlist → approve add_to_cart → cart updates”

---

## “Good Demo” Script
- User: “Find best value paper towels under $30”
- Agent: searches products, shows 3 options
- User: “Add top pick x2”
- UI: shows an approval card
- User approves
- Tool runs, cart panel updates

---

## Security / Safety Notes (internal)
- Never expose sensitive tokens in tool cards
- Approval gate for transactional tools
- Display “tool provenance” (what ran, when, result) for trust

---

## Future Enhancements
- Streaming assistant responses
- Inline product compare view (within tool cards)
- “Undo last action” (requires tool support)
- Pluggable LLM adapter (local first)
