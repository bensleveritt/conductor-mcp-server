import { VersionInputSchema } from "../types/index.ts";
import { config } from "../utils/config.ts";
import { ollama } from "../utils/ollama-client.ts";

export const versionTool = {
  name: "version",
  description: "Get server version, configuration details, and list of available tools.",
  inputSchema: VersionInputSchema,

  async execute(): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Check Ollama connection
    const ollamaAvailable = await ollama.isAvailable();

    const output = `# Conductor MCP Server

**Version**: ${config.version}

## Configuration

- **Ollama URL**: ${config.ollamaBaseUrl}
- **Ollama Status**: ${ollamaAvailable ? "✓ Connected" : "✗ Not available"}
- **Default Model**: ${config.defaultModel}
- **Max Conversations**: ${config.maxConversations}
${config.disabledTools.size > 0 ? `- **Disabled Tools**: ${Array.from(config.disabledTools).join(", ")}` : ""}

## Available Tools

### Core Tools
- **chat** - General conversation and brainstorming
- **listmodels** - List available Ollama models
- **version** - Server information (this tool)

### Workflow Tools (Priority 2)
- **debug** - Multi-step debugging with hypothesis tracking
- **thinkdeep** - Extended reasoning with thinking modes
- **planner** - Project planning and breakdown
- **consensus** - Multi-model consultation and synthesis

### Specialized Tools (Priority 3)
- **codereview** - Systematic code review with findings
- **precommit** - Git change validation

## Features

- **Conversation Continuity**: Use \`continuation_id\` to maintain context across tool calls
- **Thinking Modes**: minimal, low, medium, high, max
- **Multi-Step Workflows**: Debug, plan, and analyze with iterative steps
- **Multi-Model Consensus**: Consult multiple models for complex decisions

## Environment Variables

- \`OLLAMA_BASE_URL\` - Ollama server URL (default: http://localhost:11434)
- \`DEFAULT_MODEL\` - Default model to use (default: qwen2.5:latest)
- \`DISABLED_TOOLS\` - Comma-separated list of tools to disable
- \`MAX_CONVERSATIONS\` - Maximum conversations to keep in memory (default: 100)
`;

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  },
};
