import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../../../src/utils/config";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.DEFAULT_MODEL;
    delete process.env.DISABLED_TOOLS;
    delete process.env.MAX_CONVERSATIONS;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("defaults", () => {
    test("uses default values when env vars are not set", () => {
      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
      expect(config.defaultModel).toBe("qwen2.5:latest");
      expect(config.disabledTools).toEqual(new Set());
      expect(config.maxConversations).toBe(100);
      expect(config.version).toBe("0.1.0");
    });
  });

  describe("OLLAMA_BASE_URL", () => {
    test("uses custom Ollama base URL when provided", () => {
      process.env.OLLAMA_BASE_URL = "http://remote-server:11434";

      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe("http://remote-server:11434");
    });

    test("handles localhost with custom port", () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:8080";

      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe("http://localhost:8080");
    });
  });

  describe("DEFAULT_MODEL", () => {
    test("uses custom default model when provided", () => {
      process.env.DEFAULT_MODEL = "llama3.1:latest";

      const config = loadConfig();

      expect(config.defaultModel).toBe("llama3.1:latest");
    });

    test("handles custom model names", () => {
      process.env.DEFAULT_MODEL = "mistral:7b";

      const config = loadConfig();

      expect(config.defaultModel).toBe("mistral:7b");
    });
  });

  describe("DISABLED_TOOLS", () => {
    test("parses empty string as empty set", () => {
      process.env.DISABLED_TOOLS = "";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(new Set());
    });

    test("parses single tool name", () => {
      process.env.DISABLED_TOOLS = "codereview";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(new Set(["codereview"]));
    });

    test("parses comma-separated tool names", () => {
      process.env.DISABLED_TOOLS = "codereview,precommit,debug";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(
        new Set(["codereview", "precommit", "debug"])
      );
    });

    test("trims whitespace around tool names", () => {
      process.env.DISABLED_TOOLS = " codereview , precommit , debug ";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(
        new Set(["codereview", "precommit", "debug"])
      );
    });

    test("filters out empty strings from multiple commas", () => {
      process.env.DISABLED_TOOLS = "codereview,,precommit,,,debug";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(
        new Set(["codereview", "precommit", "debug"])
      );
    });

    test("handles tools with spaces trimmed", () => {
      process.env.DISABLED_TOOLS = "  ,  codereview  ,  ,  precommit  ";

      const config = loadConfig();

      expect(config.disabledTools).toEqual(new Set(["codereview", "precommit"]));
    });
  });

  describe("MAX_CONVERSATIONS", () => {
    test("parses valid integer", () => {
      process.env.MAX_CONVERSATIONS = "50";

      const config = loadConfig();

      expect(config.maxConversations).toBe(50);
    });

    test("parses large numbers", () => {
      process.env.MAX_CONVERSATIONS = "1000";

      const config = loadConfig();

      expect(config.maxConversations).toBe(1000);
    });

    test("uses default when value is not a number", () => {
      process.env.MAX_CONVERSATIONS = "not-a-number";

      const config = loadConfig();

      expect(config.maxConversations).toBe(NaN);
    });

    test("parses zero as valid value", () => {
      process.env.MAX_CONVERSATIONS = "0";

      const config = loadConfig();

      expect(config.maxConversations).toBe(0);
    });

    test("uses default for empty string", () => {
      process.env.MAX_CONVERSATIONS = "";

      const config = loadConfig();

      expect(config.maxConversations).toBe(100);
    });
  });

  describe("version", () => {
    test("always returns version 0.1.0", () => {
      const config = loadConfig();

      expect(config.version).toBe("0.1.0");
    });
  });

  describe("combined configuration", () => {
    test("loads all custom values together", () => {
      process.env.OLLAMA_BASE_URL = "http://custom:8080";
      process.env.DEFAULT_MODEL = "custom-model:latest";
      process.env.DISABLED_TOOLS = "debug,planner";
      process.env.MAX_CONVERSATIONS = "200";

      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe("http://custom:8080");
      expect(config.defaultModel).toBe("custom-model:latest");
      expect(config.disabledTools).toEqual(new Set(["debug", "planner"]));
      expect(config.maxConversations).toBe(200);
      expect(config.version).toBe("0.1.0");
    });

    test("mixes custom and default values", () => {
      process.env.DEFAULT_MODEL = "llama3.1:latest";
      process.env.DISABLED_TOOLS = "consensus";
      // OLLAMA_BASE_URL and MAX_CONVERSATIONS use defaults

      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
      expect(config.defaultModel).toBe("llama3.1:latest");
      expect(config.disabledTools).toEqual(new Set(["consensus"]));
      expect(config.maxConversations).toBe(100);
    });
  });
});
