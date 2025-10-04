import { z } from "zod";
import type { ChatMessage } from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

const CodeReviewInputSchema = z.object({
  step: z.string().describe("Review narrative for this step"),
  step_number: z.number().min(1).describe("Current step number"),
  total_steps: z.number().min(1).describe("Total steps planned"),
  next_step_required: z.boolean().describe("Whether another step is needed"),
  findings: z.string().describe("Findings from review"),
  files_checked: z.array(z.string()).optional().describe("Files examined"),
  relevant_files: z
    .array(z.string())
    .optional()
    .describe("Files tied to key findings"),
  issues_found: z
    .array(
      z.object({
        severity: z.enum(["critical", "high", "medium", "low"]),
        description: z.string(),
        file: z.string().optional(),
        line: z.number().optional(),
      }),
    )
    .optional()
    .describe("Issues identified"),
  model: z.string().default("qwen2.5:latest"),
  review_type: z
    .enum(["full", "security", "performance", "quick"])
    .optional()
    .default("full"),
  continuation_id: z.string().optional(),
});

type CodeReviewInput = z.infer<typeof CodeReviewInputSchema>;

export const codereviewTool = {
  name: "codereview",
  description:
    "Performs systematic, step-by-step code review with expert validation. Use for comprehensive analysis covering quality, security, performance, and architecture. Guides through structured investigation to ensure thoroughness.",
  inputSchema: CodeReviewInputSchema,

  async execute(
    input: CodeReviewInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      findings,
      files_checked = [],
      relevant_files = [],
      issues_found = [],
      model,
      review_type = "full",
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "codereview",
          model,
          review_type,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "codereview",
        model,
        review_type,
      });
    }

    // Build the review prompt
    let prompt = `# Code Review - Step ${step_number}/${total_steps}\n\n`;
    prompt += `**Review Type**: ${review_type}\n\n`;

    if (step_number === 1) {
      prompt += `## Review Strategy\n\n${step}\n\n`;
      const reviewFocus = {
        full: "quality, security, performance, and architecture",
        security: "security vulnerabilities and best practices",
        performance: "performance bottlenecks and optimization opportunities",
        quick: "critical issues and code quality basics",
      };
      prompt += `Focus areas: ${reviewFocus[review_type]}\n\n`;
    } else {
      prompt += `## Review Progress\n\n${step}\n\n`;
    }

    prompt += `### Findings\n${findings}\n\n`;

    if (files_checked.length > 0) {
      prompt += `### Files Examined\n${files_checked.map((f) => `- ${f}`).join("\n")}\n\n`;
    }

    if (relevant_files.length > 0) {
      prompt += `### Key Files\n${relevant_files.map((f) => `- ${f}`).join("\n")}\n\n`;
    }

    if (issues_found.length > 0) {
      prompt += `### Issues Identified\n`;
      const groupedIssues = {
        critical: issues_found.filter((i) => i.severity === "critical"),
        high: issues_found.filter((i) => i.severity === "high"),
        medium: issues_found.filter((i) => i.severity === "medium"),
        low: issues_found.filter((i) => i.severity === "low"),
      };

      for (const [severity, issues] of Object.entries(groupedIssues)) {
        if (issues.length > 0) {
          prompt += `\n**${severity.toUpperCase()}** (${issues.length}):\n`;
          for (const issue of issues) {
            const location = issue.file
              ? ` [${issue.file}${issue.line ? `:${issue.line}` : ""}]`
              : "";
            prompt += `- ${issue.description}${location}\n`;
          }
        }
      }
      prompt += `\n`;
    }

    if (next_step_required) {
      prompt += `### Next Review Phase\n`;
      prompt += `Continue the review by:\n`;
      prompt += `- Examining additional aspects\n`;
      prompt += `- Looking for related issues\n`;
      prompt += `- Validating findings\n`;
    } else {
      prompt += `### Review Summary\n`;
      prompt += `Provide final summary including:\n`;
      prompt += `- Overall code quality assessment\n`;
      prompt += `- Critical issues that must be addressed\n`;
      prompt += `- Recommendations for improvement\n`;
      prompt += `- Positive aspects worth noting\n`;
    }

    // Add system message
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are an expert code reviewer conducting a ${review_type} review. Provide thorough, constructive feedback with specific recommendations.`,
      });
    }

    // Add the prompt
    const userMessage: ChatMessage = {
      role: "user",
      content: prompt,
    };
    messages.push(userMessage);
    conversationMemory.addMessage(convId, userMessage);

    // Get response from Ollama
    const response = await ollama.chat({
      model,
      messages,
      options: {
        temperature: 0.5, // Lower for code review consistency
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Code Review Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    responseText += `- Review Type: ${review_type}\n`;
    responseText += `- Issues Found: ${issues_found.length}\n`;
    responseText += `- Continuation ID: ${convId}\n`;
    responseText += `- Next step required: ${next_step_required ? "Yes" : "No"}\n`;

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  },
};
