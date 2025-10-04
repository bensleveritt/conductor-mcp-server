import { describe, test, expect, mock } from "bun:test";
import { listmodelsTool } from "../../../src/tools/listmodels";
import { mockModels } from "../../fixtures/mock-ollama-responses";

describe("listmodelsTool", () => {
  describe("metadata", () => {
    test("has correct name", () => {
      expect(listmodelsTool.name).toBe("listmodels");
    });

    test("has description", () => {
      expect(listmodelsTool.description).toBeDefined();
      expect(listmodelsTool.description.length).toBeGreaterThan(0);
    });

    test("has inputSchema", () => {
      expect(listmodelsTool.inputSchema).toBeDefined();
    });
  });

  describe("execute", () => {
    test("returns list of available models", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).listModels = mock(() =>
        Promise.resolve(mockModels),
      );

      const result = await listmodelsTool.execute();

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe("text");
      expect(result.content[0]?.text).toContain("qwen2.5:latest");
      expect(result.content[0]?.text).toContain("llama3.1:latest");
      expect(result.content[0]?.text).toContain("mistral:latest");
    });

    test("formats model details correctly", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).listModels = mock(() =>
        Promise.resolve([mockModels[0]]),
      );

      const result = await listmodelsTool.execute();

      const text = result.content[0]?.text || "";

      // Check for size formatting (bytes to GB/MB)
      expect(text).toMatch(/\d+\.?\d*\s*(GB|MB)/);

      // Check for parameter size
      expect(text).toContain("7.6B");
    });

    test("handles empty model list", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).listModels = mock(() => Promise.resolve([]));

      const result = await listmodelsTool.execute();

      expect(result.content[0]?.text).toContain("No models");
    });

    test("handles ollama errors gracefully", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).listModels = mock(() =>
        Promise.reject(new Error("Connection failed")),
      );

      const result = await listmodelsTool.execute();

      expect(result.content[0]?.text).toContain("Error");
      expect(result.content[0]?.text).toContain("Connection failed");
    });

    test("handles models without details", async () => {
      const minimalModel = {
        name: "test-model",
        model: "test-model",
        modified_at: "2025-01-01T00:00:00Z",
        size: 1000000,
        digest: "abc123",
      };

      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).listModels = mock(() =>
        Promise.resolve([minimalModel]),
      );

      const result = await listmodelsTool.execute();

      expect(result.content[0]?.text).toContain("test-model");
    });
  });

  describe("input validation", () => {
    test("accepts empty input", () => {
      const result = listmodelsTool.inputSchema.parse({});
      expect(result).toEqual({});
    });

    test("ignores extra properties", () => {
      const result = listmodelsTool.inputSchema.parse({ extra: "property" });
      expect(result).toEqual({});
    });
  });
});
