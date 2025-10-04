import type { OllamaModel, OllamaChatResponse } from "../../src/types/index";

export const mockModels: OllamaModel[] = [
  {
    name: "qwen2.5:latest",
    model: "qwen2.5:latest",
    modified_at: "2025-01-01T00:00:00Z",
    size: 4661224676,
    digest: "abc123def456",
    details: {
      format: "gguf",
      family: "qwen2",
      parameter_size: "7.6B",
      quantization_level: "Q4_0",
    },
  },
  {
    name: "llama3.1:latest",
    model: "llama3.1:latest",
    modified_at: "2025-01-02T00:00:00Z",
    size: 8030261325,
    digest: "ghi789jkl012",
    details: {
      format: "gguf",
      family: "llama",
      parameter_size: "8B",
      quantization_level: "Q4_K_M",
    },
  },
  {
    name: "mistral:latest",
    model: "mistral:latest",
    modified_at: "2025-01-03T00:00:00Z",
    size: 4109865159,
    digest: "mno345pqr678",
    details: {
      format: "gguf",
      family: "mistral",
      parameter_size: "7B",
      quantization_level: "Q4_0",
    },
  },
];

export const mockChatResponse: OllamaChatResponse = {
  model: "qwen2.5:latest",
  created_at: "2025-01-04T12:00:00Z",
  message: {
    role: "assistant",
    content: "This is a mock response from the AI assistant.",
  },
  done: true,
  total_duration: 1234567890,
  load_duration: 123456789,
  prompt_eval_count: 10,
  eval_count: 20,
  eval_duration: 987654321,
};

export const mockStreamingChunks = [
  {
    model: "qwen2.5:latest",
    created_at: "2025-01-04T12:00:00Z",
    message: { role: "assistant", content: "Hello" },
    done: false,
  },
  {
    model: "qwen2.5:latest",
    created_at: "2025-01-04T12:00:01Z",
    message: { role: "assistant", content: " world" },
    done: false,
  },
  {
    model: "qwen2.5:latest",
    created_at: "2025-01-04T12:00:02Z",
    message: { role: "assistant", content: "!" },
    done: true,
    total_duration: 2000000000,
    eval_count: 3,
  },
];

export function createMockChatResponse(
  content: string,
  model: string = "qwen2.5:latest"
): OllamaChatResponse {
  return {
    model,
    created_at: new Date().toISOString(),
    message: {
      role: "assistant",
      content,
    },
    done: true,
  };
}

export function createMockStreamChunk(
  content: string,
  done: boolean = false,
  model: string = "qwen2.5:latest"
) {
  return {
    model,
    created_at: new Date().toISOString(),
    message: { role: "assistant", content },
    done,
  };
}

export function createStreamFromChunks(chunks: any[]): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      }
      controller.close();
    },
  });
}
