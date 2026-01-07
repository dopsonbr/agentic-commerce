# README.md

# Agentic Shopping POC (Local-First)

This repository contains a **local-first proof of concept** for demonstrating “agentic shopping” on top of an existing shopping experience. The goal is to validate feasibility and demo value **without investing in a full rewrite** or paid AI services.

The POC is designed to run **entirely on a developer laptop** (or a single local environment) and prove that:
- a chat experience can drive shopping workflows
- the existing SPA orchestration (NGRX) can be reused via a headless browser session
- the system can produce auditable, trustworthy tool outputs (not just “chat text”)

---

## Apps

### 1) `shop-ui`
Existing (or lightly modified) shopping Angular SPA with heavy NGRX usage.

**POC additions**
- “Automation mode” (`?automation=1`)
- In-page automation bridge (`window.__agentBridge`) to:
  - dispatch NGRX actions
  - await success/failure actions with correlation IDs
  - (optional) expose cart/context snapshots

---

### 2) `shop-api`
Existing (or stubbed) REST API layer backing the shopping experience.

**POC expectation**
- Run locally using:
  - a dev mode
  - a stubbed backend
  - or a lightweight proxy to existing services (if allowed)

The key requirement is that cart mutations ultimately hit an API endpoint so state can be observed via tool results.

---

### 3) `mcp-tools`
Tool server that exposes a small set of “shopping tools” to the chat experience.

**Responsibilities**
- Tool registry (schemas + descriptions)
- Tool routing:
  - direct REST reads via `shop-api`
  - stateful actions via `headless-session-manager` + NGRX dispatch
- Returns structured tool results suitable for UI cards (not raw logs)

---

### 4) `chat-ui`
New chat interface used by internal users to test the agentic concept.

**POC focus**
- Renders:
  - user/assistant messages
  - tool calls + tool results as cards
  - cart/shortlist context panel
- Supports **zero-cost modes**:
  - scripted agent mode (deterministic)
  - operator mode (human-in-the-loop)

---

### 5) `headless-session-manager`
Service that runs **one headless Chromium session per chat session** and executes “complex stateful actions” by calling into the `shop-ui` automation bridge.

**Responsibilities**
- Create/keep warm/destroy sessions
- Serialize execution per session
- Provide a stable server-side interface for:
  - dispatch + await NGRX action completion
- Capture diagnostics (screenshots/logs) for demo stability

---

## High-Level Architecture (Local POC)

- `chat-ui` ⇄ `mcp-tools`  
- `mcp-tools` → `shop-api` (stateless reads)  
- `mcp-tools` → `headless-session-manager` (stateful flows)  
- `headless-session-manager` → headless Chromium → `shop-ui?automation=1` → NGRX → `shop-api`

**Key idea:** We reuse existing `shop-ui` + NGRX orchestration instead of rebuilding workflows server-side.

---

## What the POC Demonstrates
- “Chat can drive shopping outcomes” (e.g., add-to-cart)
- Tool-based execution (auditable + explainable)
- Ability to operate without a paid AI API:
  - scripted agent mode
  - operator mode
  - (optional later) local LLM

---

## Local-First Principles
This POC intentionally prioritizes:
- simple local startup
- minimal infrastructure dependencies
- deterministic demos
- fast iteration on tool contracts and UX

Non-goals:
- production scalability
- multi-region deployments
- full security hardening
- perfect AI reasoning

---

## Suggested Local Run Order (Conceptual)
1) Start `shop-api`
2) Start `shop-ui`
3) Start `headless-session-manager`
4) Start `mcp-tools`
5) Start `chat-ui`

---

## POC Acceptance Criteria
A user can:
- open `chat-ui`
- search products via tools
- approve an add-to-cart action
- observe cart summary updates (tool result + context panel)
- repeat multiple actions in the same chat session using a warmed headless session

All of this should be runnable **locally** without paid AI services.
