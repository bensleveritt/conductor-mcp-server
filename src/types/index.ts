import { z } from "zod";

// Thinking modes for deep reasoning
export const ThinkingMode = z.enum(["minimal", "low", "medium", "high", "max"]);
export type ThinkingMode = z.infer<typeof ThinkingMode>;

// Confidence levels for workflows
export const ConfidenceLevel = z.enum([
  "exploring",
  "low",
  "medium",
  "high",
  "very_high",
  "almost_certain",
  "certain",
]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

// Ollama model types
export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

// Chat message types
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Conversation memory
export interface ConversationMemory {
  id: string;
  messages: ChatMessage[];
  metadata?: Record<string, any>;
  created_at: number;
  updated_at: number;
}

// Workflow state for multi-step tools
export interface WorkflowState {
  step_number: number;
  total_steps: number;
  findings: string;
  hypothesis?: string;
  confidence?: ConfidenceLevel;
  relevant_files?: string[];
  relevant_context?: string[];
  issues_found?: Array<{
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    file?: string;
    line?: number;
  }>;
}

// Tool input schemas
export const ChatInputSchema = z.object({
  prompt: z.string().describe("Your question or idea for collaborative thinking"),
  files: z.array(z.string()).optional().describe("Optional file paths for context"),
  images: z.array(z.string()).optional().describe("Optional image paths for visual context"),
  model: z.string().default("qwen2.5:latest").describe("Model to use"),
  temperature: z.number().min(0).max(1).optional().describe("0 = deterministic, 1 = creative"),
  thinking_mode: ThinkingMode.optional().describe("Reasoning depth"),
  continuation_id: z.string().optional().describe("Thread continuation ID for multi-turn conversations"),
});

export const ListModelsInputSchema = z.object({});

export const VersionInputSchema = z.object({});

export const DebugInputSchema = z.object({
  step: z.string().describe("Investigation step content"),
  step_number: z.number().min(1).describe("Current step number"),
  total_steps: z.number().min(1).describe("Estimated total steps"),
  next_step_required: z.boolean().describe("Whether another step is needed"),
  findings: z.string().describe("Discoveries and evidence from this step"),
  files_checked: z.array(z.string()).optional().describe("Files examined"),
  relevant_files: z.array(z.string()).optional().describe("Files relevant to the issue"),
  relevant_context: z.array(z.string()).optional().describe("Methods/functions involved"),
  hypothesis: z.string().optional().describe("Current theory about the issue"),
  confidence: ConfidenceLevel.optional().describe("Confidence in hypothesis"),
  backtrack_from_step: z.number().optional().describe("Step to backtrack from if needed"),
  images: z.array(z.string()).optional().describe("Screenshots or diagrams"),
  model: z.string().default("qwen2.5:latest"),
  thinking_mode: ThinkingMode.optional(),
  continuation_id: z.string().optional(),
});

export const ThinkDeepInputSchema = z.object({
  step: z.string().describe("Current thinking step"),
  step_number: z.number().min(1),
  total_steps: z.number().min(1),
  next_step_required: z.boolean(),
  findings: z.string().describe("Important findings and insights"),
  model: z.string().default("qwen2.5:latest"),
  thinking_mode: ThinkingMode.optional(),
  continuation_id: z.string().optional(),
});

export const PlannerInputSchema = z.object({
  step: z.string().describe("Planning step content"),
  step_number: z.number().min(1),
  total_steps: z.number().min(1),
  next_step_required: z.boolean(),
  is_step_revision: z.boolean().optional().describe("True when revising a previous step"),
  revises_step_number: z.number().optional().describe("Step being revised"),
  is_branch_point: z.boolean().optional().describe("True when creating a branch"),
  branch_id: z.string().optional().describe("Branch identifier"),
  branch_from_step: z.number().optional().describe("Step this branch starts from"),
  model: z.string().default("qwen2.5:latest"),
  continuation_id: z.string().optional(),
});

export const ConsensusInputSchema = z.object({
  step: z.string().describe("Consensus prompt or step content"),
  step_number: z.number().min(1),
  total_steps: z.number().min(1),
  next_step_required: z.boolean(),
  findings: z.string().describe("Analysis or model response summary"),
  models: z.array(
    z.object({
      model: z.string(),
      stance: z.enum(["for", "against", "neutral"]).optional(),
      stance_prompt: z.string().optional(),
    })
  ).min(2).describe("Models to consult with their stances"),
  current_model_index: z.number().min(0).optional().describe("Index of next model to consult"),
  model_responses: z.array(z.any()).optional().describe("Internal log of responses"),
  relevant_files: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  continuation_id: z.string().optional(),
});

// Export all input types
export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ListModelsInput = z.infer<typeof ListModelsInputSchema>;
export type VersionInput = z.infer<typeof VersionInputSchema>;
export type DebugInput = z.infer<typeof DebugInputSchema>;
export type ThinkDeepInput = z.infer<typeof ThinkDeepInputSchema>;
export type PlannerInput = z.infer<typeof PlannerInputSchema>;
export type ConsensusInput = z.infer<typeof ConsensusInputSchema>;
