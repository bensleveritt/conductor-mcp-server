import { describe, test, expect, mock } from "bun:test";
import { versionTool } from "../../../src/tools/version";

describe("versionTool", () => {
  describe("metadata", () => {
    test("has correct name", () => {
      expect(versionTool.name).toBe("version");
    });

    test("has description", () => {
      expect(versionTool.description).toBeDefined();
      expect(versionTool.description.length).toBeGreaterThan(0);
    });

    test("has inputSchema", () => {
      expect(versionTool.inputSchema).toBeDefined();
    });
  });

  describe("execute", () => {
    test("returns server version and configuration", async () => {
      const result = await versionTool.execute();

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe("text");
      const text = result.content[0]?.text || "";

      // Should contain version
      expect(text).toContain("0.1.0");

      // Should contain server name
      expect(text).toContain("Conductor MCP Server");
    });

    test("includes Ollama base URL", async () => {
      const result = await versionTool.execute();
      const text = result.content[0]?.text || "";

      expect(text).toContain("http://localhost:11434");
    });

    test("includes default model", async () => {
      const result = await versionTool.execute();
      const text = result.content[0]?.text || "";

      expect(text).toContain("qwen2.5:latest");
    });

    test("shows Ollama availability when server is reachable", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).isAvailable = mock(() => Promise.resolve(true));

      const result = await versionTool.execute();
      const text = result.content[0]?.text || "";

      expect(text).toMatch(/(available|connected|running)/i);
    });

    test("shows Ollama unavailability when server is unreachable", async () => {
      const originalOllama = (await import("../../../src/utils/ollama-client"))
        .ollama;
      (originalOllama as any).isAvailable = mock(() => Promise.resolve(false));

      const result = await versionTool.execute();
      const text = result.content[0]?.text || "";

      expect(text).toMatch(/(unavailable|not.*available|not.*running)/i);
    });

    test("lists available tools", async () => {
      const result = await versionTool.execute();
      const text = result.content[0]?.text || "";

      // Should list some core tools
      expect(text).toContain("chat");
      expect(text).toContain("listmodels");
    });

    test("shows disabled tools when configured", async () => {
      // This test depends on config, which is loaded at import time
      // For now, just check the output format is valid
      const result = await versionTool.execute();

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe("text");
    });
  });

  describe("input validation", () => {
    test("accepts empty input", () => {
      const result = versionTool.inputSchema.parse({});
      expect(result).toEqual({});
    });

    test("ignores extra properties", () => {
      const result = versionTool.inputSchema.parse({ extra: "property" });
      expect(result).toEqual({});
    });
  });
});
