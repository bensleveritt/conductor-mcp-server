#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { config } from "./src/utils/config.ts";
import { chatTool } from "./src/tools/chat.ts";
import { listmodelsTool } from "./src/tools/listmodels.ts";
import { versionTool } from "./src/tools/version.ts";
import { debugTool } from "./src/tools/debug.ts";
import { thinkdeepTool } from "./src/tools/thinkdeep.ts";
import { plannerTool } from "./src/tools/planner.ts";
import { consensusTool } from "./src/tools/consensus.ts";
import { codereviewTool } from "./src/tools/codereview.ts";
import { precommitTool } from "./src/tools/precommit.ts";

// Define all available tools
const ALL_TOOLS = [
  // Core tools
  chatTool,
  listmodelsTool,
  versionTool,

  // Workflow tools
  debugTool,
  thinkdeepTool,
  plannerTool,
  consensusTool,

  // Specialized tools
  codereviewTool,
  precommitTool,
];

// Filter out disabled tools
const enabledTools = ALL_TOOLS.filter(
  (tool) => !config.disabledTools.has(tool.name),
);

// Create MCP server
const server = new Server(
  {
    name: "conductor-mcp-server",
    version: config.version,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: enabledTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: tool.inputSchema.shape,
        required: Object.keys(tool.inputSchema.shape).filter(
          (key) => !(tool.inputSchema.shape as any)[key]?.isOptional?.(),
        ),
      },
    })),
  };
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Find the tool
  const tool = enabledTools.find((t) => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    // Validate input
    const validatedInput = tool.inputSchema.parse(args);

    // Execute the tool
    // @ts-expect-error - validatedInput is correctly typed but TS can't narrow the union
    const result = await tool.execute(validatedInput);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Unknown error executing tool ${name}`,
        },
      ],
      isError: true,
    };
  }
});

// Error handler
server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Conductor MCP Server v${config.version} running`);
  console.error(`Ollama URL: ${config.ollamaBaseUrl}`);
  console.error(`Default Model: ${config.defaultModel}`);
  console.error(`Enabled Tools: ${enabledTools.map((t) => t.name).join(", ")}`);

  if (config.disabledTools.size > 0) {
    console.error(
      `Disabled Tools: ${Array.from(config.disabledTools).join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
