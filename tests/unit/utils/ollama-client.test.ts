import { describe, test, expect, beforeEach, mock } from "bun:test";
import { OllamaClient } from "../../../src/utils/ollama-client";
import type { OllamaModel, OllamaChatRequest } from "../../../src/types/index";

describe("OllamaClient", () => {
  let client: OllamaClient;
  const baseUrl = "http://localhost:11434";

  beforeEach(() => {
    client = new OllamaClient(baseUrl);
  });

  describe("constructor", () => {
    test("removes trailing slash from baseUrl", () => {
      const clientWithSlash = new OllamaClient("http://localhost:11434/");
      expect((clientWithSlash as any).baseUrl).toBe("http://localhost:11434");
    });

    test("uses default baseUrl when not provided", () => {
      const defaultClient = new OllamaClient();
      expect((defaultClient as any).baseUrl).toBe("http://localhost:11434");
    });
  });

  describe("listModels", () => {
    test("returns list of models on success", async () => {
      const mockModels: OllamaModel[] = [
        {
          name: "qwen2.5:latest",
          model: "qwen2.5:latest",
          modified_at: "2025-01-01T00:00:00Z",
          size: 1000000,
          digest: "abc123",
        },
        {
          name: "llama3.1:latest",
          model: "llama3.1:latest",
          modified_at: "2025-01-02T00:00:00Z",
          size: 2000000,
          digest: "def456",
        },
      ];

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ models: mockModels }),
        } as Response),
      );

      const models = await client.listModels();

      expect(models).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/tags`);
    });

    test("throws error when response is not ok", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: false,
          statusText: "Internal Server Error",
        } as Response),
      );

      await expect(client.listModels()).rejects.toThrow(
        "Failed to list models: Internal Server Error",
      );
    });

    test("throws error on network failure", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.reject(new Error("Network error")),
      );

      await expect(client.listModels()).rejects.toThrow("Network error");
    });
  });

  describe("isAvailable", () => {
    test("returns true when server is reachable", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
        } as Response),
      );

      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    test("returns false when server returns error", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: false,
        } as Response),
      );

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    test("returns false on network failure", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.reject(new Error("Network error")),
      );

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe("chat", () => {
    test("sends chat request and returns response", async () => {
      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
      };

      const mockResponse = {
        model: "qwen2.5:latest",
        created_at: "2025-01-01T00:00:00Z",
        message: { role: "assistant" as const, content: "Hi there!" },
        done: true,
      };

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const response = await client.chat(request);

      expect(response).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
      });
    });

    test("includes options in request", async () => {
      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      };

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            model: "qwen2.5:latest",
            created_at: "2025-01-01T00:00:00Z",
            message: { role: "assistant", content: "Response" },
            done: true,
          }),
        } as Response),
      );

      await client.chat(request);

      const callArgs = (fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options).toEqual({
        temperature: 0.7,
        top_p: 0.9,
      });
    });

    test("throws error when response is not ok", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: false,
          statusText: "Bad Request",
        } as Response),
      );

      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
      };

      await expect(client.chat(request)).rejects.toThrow(
        "Chat request failed: Bad Request",
      );
    });
  });

  describe("chatStream", () => {
    test("yields streaming response chunks", async () => {
      const chunks = [
        {
          model: "qwen2.5:latest",
          created_at: "2025-01-01T00:00:00Z",
          message: { role: "assistant" as const, content: "Hello" },
          done: false,
        },
        {
          model: "qwen2.5:latest",
          created_at: "2025-01-01T00:00:00Z",
          message: { role: "assistant" as const, content: " world" },
          done: false,
        },
        {
          model: "qwen2.5:latest",
          created_at: "2025-01-01T00:00:00Z",
          message: { role: "assistant" as const, content: "!" },
          done: true,
        },
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
          }
          controller.close();
        },
      });

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          body: stream,
        } as Response),
      );

      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
      };

      const results = [];
      for await (const chunk of client.chatStream(request)) {
        results.push(chunk);
      }

      expect(results).toEqual(chunks);
    });

    test("throws error when response is not ok", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: false,
          statusText: "Internal Server Error",
        } as Response),
      );

      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
      };

      try {
        for await (const _ of client.chatStream(request)) {
          // Should not reach here
        }
        expect(true).toBe(false); // Should have thrown
      } catch (error) {
        expect((error as Error).message).toContain(
          "Chat stream request failed",
        );
      }
    });

    test("throws error when response body is null", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          body: null,
        } as Response),
      );

      const request: OllamaChatRequest = {
        model: "qwen2.5:latest",
        messages: [{ role: "user", content: "Hello" }],
      };

      try {
        for await (const _ of client.chatStream(request)) {
          // Should not reach here
        }
        expect(true).toBe(false); // Should have thrown
      } catch (error) {
        expect((error as Error).message).toBe("Response body is null");
      }
    });
  });

  describe("generate", () => {
    test("sends request and returns content string", async () => {
      const mockResponse = {
        model: "qwen2.5:latest",
        created_at: "2025-01-01T00:00:00Z",
        message: { role: "assistant", content: "Generated response" },
        done: true,
      };

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        } as Response),
      );

      const response = await client.generate(
        "qwen2.5:latest",
        [{ role: "user", content: "Test" }],
        { temperature: 0.5 },
      );

      expect(response).toBe("Generated response");
    });

    test("includes temperature option", async () => {
      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            model: "qwen2.5:latest",
            created_at: "2025-01-01T00:00:00Z",
            message: { role: "assistant", content: "Response" },
            done: true,
          }),
        } as Response),
      );

      await client.generate(
        "qwen2.5:latest",
        [{ role: "user", content: "Test" }],
        { temperature: 0.8 },
      );

      const callArgs = (fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options?.temperature).toBe(0.8);
    });
  });

  describe("generateStream", () => {
    test("yields content strings from stream", async () => {
      const chunks = [
        { message: { content: "Hello" }, done: false },
        { message: { content: " world" }, done: false },
        { message: { content: "!" }, done: true },
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
          }
          controller.close();
        },
      });

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          body: stream,
        } as Response),
      );

      const results = [];
      for await (const content of client.generateStream(
        "qwen2.5:latest",
        [{ role: "user", content: "Test" }],
        { temperature: 0.5 },
      )) {
        results.push(content);
      }

      expect(results).toEqual(["Hello", " world", "!"]);
    });

    test("skips chunks without content", async () => {
      const chunks = [
        { message: { content: "Hello" }, done: false },
        { message: {}, done: false }, // No content
        { message: { content: "world" }, done: true },
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
          }
          controller.close();
        },
      });

      (globalThis.fetch as any) = mock(() =>
        Promise.resolve({
          ok: true,
          body: stream,
        } as Response),
      );

      const results = [];
      for await (const content of client.generateStream("qwen2.5:latest", [
        { role: "user", content: "Test" },
      ])) {
        results.push(content);
      }

      expect(results).toEqual(["Hello", "world"]);
    });
  });
});
