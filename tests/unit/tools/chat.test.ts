import { describe, test, expect, beforeEach, mock } from "bun:test";
import { chatTool } from "../../../src/tools/chat";
import { ConversationMemoryManager } from "../../../src/utils/memory";
import { createMockChatResponse } from "../../fixtures/mock-ollama-responses";
import type { ChatInput } from "../../../src/types/index";

describe("chatTool", () => {
  let memoryManager: ConversationMemoryManager;
  let mockOllamaChat: any;

  beforeEach(() => {
    memoryManager = new ConversationMemoryManager();
    mockOllamaChat = mock(() =>
      Promise.resolve(createMockChatResponse("Test response")),
    );
  });

  describe("metadata", () => {
    test("has correct name", () => {
      expect(chatTool.name).toBe("chat");
    });

    test("has description", () => {
      expect(chatTool.description).toBeDefined();
      expect(chatTool.description.length).toBeGreaterThan(0);
    });

    test("has inputSchema", () => {
      expect(chatTool.inputSchema).toBeDefined();
    });
  });

  describe("execute - new conversation", () => {
    test("creates new conversation and returns response", async () => {
      const input: ChatInput = {
        prompt: "Hello, how are you?",
        model: "qwen2.5:latest",
      };

      // Mock ollama client
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).chat = mockOllamaChat;

      const result = await chatTool.execute(input);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe("text");
      expect(result.content[0]?.text).toContain("Test response");
      expect(result.content[0]?.text).toContain("Conversation ID:");
      expect(mockOllamaChat).toHaveBeenCalled();
    });

    test("includes files in context when provided", async () => {
      const input: ChatInput = {
        prompt: "Analyze these files",
        files: ["file1.ts", "file2.ts"],
        model: "qwen2.5:latest",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).chat = mockOllamaChat;

      await chatTool.execute(input);

      const callArgs = mockOllamaChat.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === "user");
      expect(userMessage.content).toContain("file1.ts");
      expect(userMessage.content).toContain("file2.ts");
      expect(userMessage.content).toContain("Analyze these files");
    });

    test("adds system message for thinking_mode", async () => {
      const input: ChatInput = {
        prompt: "Complex question",
        thinking_mode: "high",
        model: "qwen2.5:latest",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).chat = mockOllamaChat;

      await chatTool.execute(input);

      const callArgs = mockOllamaChat.mock.calls[0][0];
      const systemMessage = callArgs.messages.find(
        (m: any) => m.role === "system",
      );
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain("high thinking mode");
    });

    test("passes temperature option to ollama", async () => {
      const input: ChatInput = {
        prompt: "Test",
        temperature: 0.8,
        model: "qwen2.5:latest",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).chat = mockOllamaChat;

      await chatTool.execute(input);

      const callArgs = mockOllamaChat.mock.calls[0][0];
      expect(callArgs.options?.temperature).toBe(0.8);
    });
  });

  describe("execute - continuation", () => {
    test("continues existing conversation", async () => {
      // Create a conversation manually
      const convId = memoryManager.create([
        { role: "user", content: "Previous message" },
        { role: "assistant", content: "Previous response" },
      ]);

      const input: ChatInput = {
        prompt: "Follow-up question",
        continuation_id: convId,
        model: "qwen2.5:latest",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      const originalMemory = (await import("../../../src/utils/memory"))
        .conversationMemory;

      // Replace with our test memory manager
      (originalMemory as any).getMessages = (id: string) =>
        memoryManager.getMessages(id);
      (originalMemory as any).addMessage = (id: string, msg: any) =>
        memoryManager.addMessage(id, msg);
      (originalOllama as any).chat = mockOllamaChat;

      const result = await chatTool.execute(input);

      // Should not include new conversation ID message
      expect(result.content[0]?.text).not.toContain("Conversation ID:");

      // Check that previous messages were included
      const callArgs = mockOllamaChat.mock.calls[0][0];
      expect(callArgs.messages.length).toBeGreaterThan(2); // Previous messages + new message
    });

    test("creates new conversation for invalid continuation_id", async () => {
      const input: ChatInput = {
        prompt: "Test",
        continuation_id: "invalid_id_does_not_exist",
        model: "qwen2.5:latest",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      const originalMemory = (await import("../../../src/utils/memory"))
        .conversationMemory;

      (originalMemory as any).getMessages = () => []; // Simulate invalid ID
      (originalMemory as any).create = () => "new_conv_id";
      (originalMemory as any).addMessage = () => {};
      (originalOllama as any).chat = mockOllamaChat;

      const result = await chatTool.execute(input);

      // With invalid continuation_id, it creates new conversation but doesn't show ID
      // because continuation_id was provided (even though invalid)
      expect(result.content[0]?.text).toContain("Test response");
      expect(mockOllamaChat).toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    test("validates prompt is required", () => {
      const input = {
        model: "qwen2.5:latest",
      } as any;

      expect(() => chatTool.inputSchema.parse(input)).toThrow();
    });

    test("validates model has default", () => {
      const input = {
        prompt: "Test",
      };

      const result = chatTool.inputSchema.parse(input);
      expect(result.model).toBe("qwen2.5:latest");
    });

    test("validates temperature range", () => {
      const invalidInput = {
        prompt: "Test",
        temperature: 1.5, // Out of range
      };

      expect(() => chatTool.inputSchema.parse(invalidInput)).toThrow();
    });

    test("validates thinking_mode enum", () => {
      const invalidInput = {
        prompt: "Test",
        thinking_mode: "invalid" as any,
      };

      expect(() => chatTool.inputSchema.parse(invalidInput)).toThrow();
    });

    test("accepts valid thinking_mode values", () => {
      const modes = ["minimal", "low", "medium", "high", "max"] as const;

      for (const mode of modes) {
        const input = {
          prompt: "Test",
          thinking_mode: mode,
        };

        const result = chatTool.inputSchema.parse(input);
        expect(result.thinking_mode).toBe(mode);
      }
    });

    test("accepts optional files array", () => {
      const input = {
        prompt: "Test",
        files: ["file1.ts", "file2.ts"],
      };

      const result = chatTool.inputSchema.parse(input);
      expect(result.files).toEqual(["file1.ts", "file2.ts"]);
    });
  });
});
