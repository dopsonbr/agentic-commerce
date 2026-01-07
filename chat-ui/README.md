# chat-ui

Chat interface for testing the agentic shopping concept.

## Overview

This is the frontend chat application that allows users to interact with the shopping system using natural language. It features a **scripted agent mode** that uses pattern matching to invoke tools without requiring an LLM.

## Stack

- **Runtime:** Bun
- **UI Framework:** React 19
- **Styling:** Tailwind CSS
- **Components:** Radix UI primitives
- **Port:** 5173

## Features

- Conversation feed with user/assistant messages
- Tool call + result rendering as cards
- Cart summary context panel
- Session info display
- Scripted agent mode (deterministic, no LLM required)
- Approval flow for impactful actions

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Configuration

Environment variables:
```bash
PORT=5173
MCP_TOOLS_URL=http://localhost:3001
CHAT_MODE=scripted  # scripted | operator
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           chat-ui                                   │
│                                                                     │
│  ┌─────────────────────────────────┬───────────────────────────┐   │
│  │      Conversation Panel         │      Context Panel        │   │
│  │                                 │                           │   │
│  │  ┌───────────────────────────┐ │  ┌─────────────────────┐  │   │
│  │  │ User message              │ │  │   Cart Summary      │  │   │
│  │  └───────────────────────────┘ │  │   Items: N          │  │   │
│  │  ┌───────────────────────────┐ │  │   Total: $X.XX      │  │   │
│  │  │ [Tool Call Card]          │ │  └─────────────────────┘  │   │
│  │  │  Tool result rendered     │ │                           │   │
│  │  └───────────────────────────┘ │  ┌─────────────────────┐  │   │
│  │  ┌───────────────────────────┐ │  │   Session Info      │  │   │
│  │  │ [Message Input]           │ │  │   Customer: X       │  │   │
│  │  └───────────────────────────┘ │  └─────────────────────┘  │   │
│  └─────────────────────────────────┴───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Scripted Agent Mode

The chat uses pattern matching to determine which tool to invoke:

| Pattern | Tool | Example |
|---------|------|---------|
| `customer id is X` | `set_customer_id` | "my customer id is 123456" |
| `show/find/search X` | `search_products` | "show me hammers" |
| `add X to cart` | `add_to_cart` | "add the hammer to my cart" |
| `what's in my cart` | `get_cart` | "what's in my cart" |

## Demo Script

```
User: "my customer id is 123456"
→ Calls set_customer_id, updates session info

User: "show me info about a hammer"
→ Calls search_products, displays product card

User: "add the hammer to my cart"
→ Calls add_to_cart, shows confirmation, updates cart panel

User: "what's in my cart"
→ Calls get_cart, displays cart contents
```

## File Structure (Target)

```
chat-ui/
├── src/
│   ├── index.ts              # Server entry
│   ├── index.html            # HTML entry
│   ├── frontend.tsx          # React entry
│   ├── App.tsx               # Main component
│   ├── components/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   ├── ToolCallCard.tsx
│   │   ├── ToolResultCard.tsx
│   │   ├── ProductCard.tsx
│   │   ├── CartSummary.tsx
│   │   └── SessionInfo.tsx
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useScriptedAgent.ts
│   │   └── useToolExecution.ts
│   ├── services/
│   │   ├── mcp-client.ts
│   │   └── session.ts
│   └── types/
│       └── events.ts
├── styles/
│   └── globals.css
├── package.json
└── tsconfig.json
```

## Component Responsibilities

| Component | Purpose |
|-----------|---------|
| `ChatContainer` | Main layout, orchestrates panels |
| `MessageList` | Renders conversation history |
| `MessageInput` | User text input |
| `ToolCallCard` | Shows tool invocation |
| `ToolResultCard` | Renders tool results by type |
| `ProductCard` | Product display for search results |
| `CartSummary` | Side panel cart overview |
| `SessionInfo` | Shows session/customer context |

## Hooks

| Hook | Purpose |
|------|---------|
| `useChat` | Manages conversation state |
| `useScriptedAgent` | Pattern matching for tool selection |
| `useToolExecution` | Calls mcp-tools API |

## Tool Result Rendering

Each tool has a specialized renderer:

- `search_products` → `ProductListCard`
- `add_to_cart` → `CartConfirmationCard`
- `get_cart` → `CartContentsCard`
- Default → `JsonCard`

## Event Types

```typescript
type ChatEvent =
  | { type: "user_message"; content: string }
  | { type: "assistant_message"; content: string }
  | { type: "tool_call"; toolName: string; args: unknown; callId: string }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "error"; message: string };
```

## Security Notes

- Never expose sensitive tokens in tool cards
- Approval gate for transactional tools
- Display tool provenance (what ran, when, result) for trust
