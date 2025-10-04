export interface Config {
  ollamaBaseUrl: string;
  defaultModel: string;
  disabledTools: Set<string>;
  maxConversations: number;
  version: string;
}

export function loadConfig(): Config {
  const disabledTools = new Set(
    (process.env.DISABLED_TOOLS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  return {
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    defaultModel: process.env.DEFAULT_MODEL || "qwen2.5:latest",
    disabledTools,
    maxConversations: parseInt(process.env.MAX_CONVERSATIONS || "100", 10),
    version: "0.1.0",
  };
}

export const config = loadConfig();
