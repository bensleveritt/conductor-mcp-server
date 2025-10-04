import type {
  OllamaModel,
  OllamaListResponse,
  OllamaChatRequest,
  OllamaChatResponse,
  ChatMessage,
} from "../types/index.ts";

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * List all available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }
    const data = (await response.json()) as OllamaListResponse;
    return data.models;
  }

  /**
   * Check if Ollama server is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Chat with a model (non-streaming)
   */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    return (await response.json()) as OllamaChatResponse;
  }

  /**
   * Chat with a model (streaming)
   */
  async *chatStream(
    request: OllamaChatRequest
  ): AsyncGenerator<OllamaChatResponse, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat stream request failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as OllamaChatResponse;
              yield chunk;
            } catch (e) {
              console.error("Failed to parse chunk:", line, e);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer) as OllamaChatResponse;
          yield chunk;
        } catch (e) {
          console.error("Failed to parse final chunk:", buffer, e);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate a response with conversation context
   */
  async generate(
    model: string,
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      stream?: boolean;
    }
  ): Promise<string> {
    const request: OllamaChatRequest = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature,
      },
    };

    const response = await this.chat(request);
    return response.message.content;
  }

  /**
   * Generate a streaming response with conversation context
   */
  async *generateStream(
    model: string,
    messages: ChatMessage[],
    options?: {
      temperature?: number;
    }
  ): AsyncGenerator<string, void, unknown> {
    const request: OllamaChatRequest = {
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature,
      },
    };

    for await (const chunk of this.chatStream(request)) {
      if (chunk.message?.content) {
        yield chunk.message.content;
      }
    }
  }
}

// Export a singleton instance
export const ollama = new OllamaClient(
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
);
