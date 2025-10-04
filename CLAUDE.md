# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Conductor is an MCP (Model Context Protocol) server that orchestrates Ollama models for AI-assisted development workflows. It provides sophisticated multi-step reasoning tools built on top of local Ollama models.

## Development Commands

```bash
# Development with hot reload
bun run dev

# Run the server
bun run start

# Build for distribution
bun run build

# Type checking
bun run typecheck
# Or directly:
tsc --noEmit index.ts
```

## MCP Server Configuration

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/conductor-mcp-server/index.ts"],
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434",
        "DEFAULT_MODEL": "qwen2.5:latest"
      }
    }
  }
}
```

## Architecture

### Core Components

**Server Entry Point** (`index.ts`)
- Initializes MCP server using `@modelcontextprotocol/sdk`
- Loads and registers all tools from `src/tools/`
- Handles tool filtering based on `DISABLED_TOOLS` environment variable
- Sets up request handlers for `ListTools` and `CallTool`

**Tool System** (`src/tools/*.ts`)
- Each tool exports an object with `name`, `description`, `inputSchema` (Zod schema), and `execute` function
- Tools are auto-registered in `index.ts` via the `ALL_TOOLS` array
- Core tools (chat, listmodels, version) are always enabled
- Workflow tools (debug, thinkdeep, planner, consensus) support multi-step reasoning
- Specialized tools (codereview, precommit) provide specific analysis workflows

**Ollama Integration** (`src/utils/ollama-client.ts`)
- Singleton `OllamaClient` wraps Ollama REST API
- Supports both streaming and non-streaming chat
- Handles message history for context
- Base URL configurable via `OLLAMA_BASE_URL` environment variable

**Conversation Memory** (`src/utils/memory.ts`)
- `ConversationMemoryManager` maintains conversation state across tool calls
- Uses unique conversation IDs for continuity
- Auto-cleanup of old conversations (24h TTL, max 100 conversations)
- Stores messages and metadata per conversation

**Type System** (`src/types/index.ts`)
- Centralized Zod schemas for all tool inputs
- TypeScript types for Ollama API requests/responses
- Workflow state interfaces for multi-step tools
- Thinking modes: minimal, low, medium, high, max
- Confidence levels: exploring, low, medium, high, very_high, almost_certain, certain

**Configuration** (`src/utils/config.ts`)
- Loads from environment variables with sensible defaults
- See `.env.example` for all available options

### Conversation Continuity Pattern

All workflow tools support `continuation_id` to maintain context across multiple tool calls:

1. First call creates a conversation, returns the ID
2. Subsequent calls pass the same ID to continue the conversation
3. Conversation memory stores full message history
4. Works across different tool types (chat → debug → thinkdeep, etc.)

### Multi-Step Workflow Pattern

Tools like debug, thinkdeep, planner use a step-based approach:

```typescript
{
  step: "Current step description",
  step_number: 1,           // Current step (1-indexed)
  total_steps: 3,           // Estimated total
  next_step_required: true, // Whether to continue
  findings: "What was discovered in this step",
  continuation_id: "conv_..." // Optional, for context
}
```

Each step builds on previous context. The tool orchestrates multiple LLM calls to perform systematic analysis.

## Path Aliases

TypeScript path aliases are configured in `tsconfig.json`:

- `@/*` → `./src/*`
- `@/types/*` → `./src/types/*`
- `@/tools/*` → `./src/tools/*`
- `@/utils/*` → `./src/utils/*`

## Adding New Tools

1. Create `src/tools/your-tool.ts`:

```typescript
import { z } from "zod";

const YourToolInputSchema = z.object({
  // Define inputs
});

export const yourTool = {
  name: "your-tool",
  description: "Tool description",
  inputSchema: YourToolInputSchema,
  async execute(input: z.infer<typeof YourToolInputSchema>) {
    // Implementation
    return {
      content: [{ type: "text", text: "Response" }]
    };
  }
};
```

2. Add schema to `src/types/index.ts` if needed
3. Import and add to `ALL_TOOLS` array in `index.ts`

## Prerequisites

- Bun v1.2+
- Ollama running locally with at least one model installed
- TypeScript 5+ (peer dependency)
