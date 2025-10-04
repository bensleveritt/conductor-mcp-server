# Conductor MCP Server 🎼

An MCP (Model Context Protocol) server that conducts and orchestrates Ollama models for AI-assisted development workflows. Built with Bun and TypeScript.

## Features

- 🦙 **Ollama Integration**: Seamless connection to local Ollama models
- 🔄 **Conversation Continuity**: Maintain context across tool calls with continuation IDs
- 🧠 **Multi-Step Workflows**: Debug, plan, and analyze with iterative reasoning
- 🎭 **Multi-Model Consensus**: Consult multiple models for complex decisions
- 🎯 **Thinking Modes**: Adjustable reasoning depth (minimal → max)
- 🛠️ **Rich Tool Set**: From simple chat to complex code review workflows

## Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Ollama](https://ollama.ai) running locally
- At least one Ollama model installed (e.g., `ollama pull qwen2.5:latest`)

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd conductor-mcp-server

# Install dependencies
bun install
```

## Configuration

Create a `.env` file in the root directory (optional):

```bash
# Ollama server URL
OLLAMA_BASE_URL=http://localhost:11434

# Default model to use
DEFAULT_MODEL=qwen2.5:latest

# Comma-separated list of tools to disable
DISABLED_TOOLS=codereview,precommit

# Maximum conversations to keep in memory
MAX_CONVERSATIONS=100
```

## Usage

### Running the Server

```bash
# Development mode (with watch)
bun run dev

# Production mode
bun run start
```

### Configuring in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "bun",
      "args": ["run", "/path/to/conductor-mcp-server/index.ts"]
    }
  }
}
```

Or with environment variables:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "bun",
      "args": ["run", "/path/to/conductor-mcp-server/index.ts"],
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434",
        "DEFAULT_MODEL": "qwen2.5:latest"
      }
    }
  }
}
```

## Available Tools

### Core Tools

#### `chat`
General conversation and collaborative thinking. Use for brainstorming, getting second opinions, and exploring ideas.

**Parameters:**
- `prompt` (required): Your question or idea
- `files` (optional): File paths for context
- `model` (optional): Model to use (default: qwen2.5:latest)
- `temperature` (optional): 0-1, controls creativity
- `thinking_mode` (optional): minimal, low, medium, high, max
- `continuation_id` (optional): Continue previous conversation

#### `listmodels`
List all available Ollama models with their details.

#### `version`
Display server version, configuration, and available tools.

### Workflow Tools (Priority 2)

#### `debug`
Systematic debugging with multi-step hypothesis testing. Guides through root cause analysis with evidence collection.

**Key Features:**
- Step-by-step investigation
- Hypothesis tracking with confidence levels
- File examination tracking
- Backtracking support

#### `thinkdeep`
Extended reasoning for complex analysis. Use for architecture decisions, performance challenges, and deep problem exploration.

**Thinking Modes:**
- `minimal`: Quick, focused analysis
- `low`: Basic reasoning
- `medium`: Moderate analysis
- `high`: Deep analysis with multiple perspectives
- `max`: Comprehensive exploration

#### `planner`
Interactive project planning with revision and branching capabilities. Breaks down complex tasks into manageable steps.

**Features:**
- Sequential planning
- Step revision
- Alternative branch exploration
- Dependency tracking

#### `consensus`
Multi-model consultation for complex decisions. Gather perspectives from different models with configurable stances.

**Parameters:**
- `models`: Array of models with optional stances (for/against/neutral)
- Systematic consultation process
- Final synthesis of all perspectives

### Specialized Tools (Priority 3)

#### `codereview`
Comprehensive code review covering quality, security, performance, and architecture.

**Review Types:**
- `full`: Complete analysis
- `security`: Security-focused
- `performance`: Performance-focused
- `quick`: Critical issues only

#### `precommit`
Pre-commit validation to prevent bugs and quality issues from being committed.

**Features:**
- Staged/unstaged change analysis
- Security vulnerability detection
- Breaking change identification
- Commit message suggestions

## Conversation Continuity

All workflow tools support `continuation_id` for maintaining context:

```typescript
// First call creates a conversation
chat({ prompt: "Explain async/await" })
// Returns: conversation_id: "conv_123..."

// Continue the conversation
chat({
  prompt: "Now show an example",
  continuation_id: "conv_123..."
})
```

## Multi-Step Workflows

Workflow tools (debug, thinkdeep, planner, consensus) use a step-based approach:

```typescript
debug({
  step: "Initial investigation of memory leak",
  step_number: 1,
  total_steps: 3,
  next_step_required: true,
  findings: "High memory usage in production",
  hypothesis: "Possible event listener leak",
  confidence: "medium"
})
```

## Example: Multi-Model Consensus

```typescript
consensus({
  step: "Should we migrate to microservices?",
  step_number: 1,
  total_steps: 4, // Initial + 2 models + synthesis
  next_step_required: true,
  findings: "Current monolith has scaling issues",
  models: [
    { model: "qwen2.5:latest", stance: "for" },
    { model: "llama3.1:latest", stance: "against" }
  ]
})
```

## Development

```bash
# Run in development mode
bun run dev

# Build for distribution
bun run build

# Run tests (when added)
bun test
```

## Project Structure

```
conductor-mcp-server/
├── src/
│   ├── tools/          # Tool implementations
│   │   ├── chat.ts
│   │   ├── debug.ts
│   │   ├── thinkdeep.ts
│   │   └── ...
│   ├── types/          # TypeScript types and schemas
│   │   └── index.ts
│   └── utils/          # Utilities
│       ├── ollama-client.ts
│       ├── memory.ts
│       └── config.ts
├── index.ts            # Main server entry point
├── package.json
└── tsconfig.json
```

## Architecture

- **MCP Server**: Built on @modelcontextprotocol/sdk
- **Ollama Client**: REST API integration with streaming support
- **Memory Management**: Conversation history with automatic cleanup
- **Tool Registry**: Dynamic tool loading with disable capability
- **Zod Validation**: Type-safe input validation

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama (if not running)
ollama serve
```

### Model Not Found

```bash
# List available models
ollama list

# Pull a model
ollama pull qwen2.5:latest
```

### MCP Server Not Responding

1. Check Claude Desktop logs
2. Verify the server path in config
3. Ensure Bun is in your PATH
4. Try running the server manually: `bun run index.ts`

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

## Credits

Inspired by [zen-mcp-server](https://github.com/BeehiveInnovations/zen-mcp-server)
