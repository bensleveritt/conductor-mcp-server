import { z } from "zod";
import type { ChatMessage } from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

const PrecommitInputSchema = z.object({
  step: z.string().describe("Validation step content"),
  step_number: z.number().min(1).describe("Current step number"),
  total_steps: z.number().min(1).describe("Total steps planned"),
  next_step_required: z.boolean().describe("Whether another step is needed"),
  findings: z.string().describe("Validation findings"),
  path: z.string().optional().describe("Repository path"),
  relevant_files: z
    .array(z.string())
    .optional()
    .describe("Files involved in changes"),
  issues_found: z
    .array(
      z.object({
        severity: z.enum(["critical", "high", "medium", "low"]),
        description: z.string(),
        file: z.string().optional(),
      }),
    )
    .optional()
    .describe("Issues identified"),
  model: z.string().default("qwen2.5:latest"),
  include_staged: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include staged changes"),
  include_unstaged: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include unstaged changes"),
  continuation_id: z.string().optional(),
});

type PrecommitInput = z.infer<typeof PrecommitInputSchema>;

export const precommitTool = {
  name: "precommit",
  description:
    "Validates git changes and repository state before committing with systematic analysis. Use for multi-repository validation, security review, change impact assessment, and completeness verification. Guides through structured investigation with expert analysis.",
  inputSchema: PrecommitInputSchema,

  async execute(
    input: PrecommitInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      findings,
      path,
      relevant_files = [],
      issues_found = [],
      model,
      include_staged = true,
      include_unstaged = true,
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "precommit",
          model,
          path,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "precommit",
        model,
        path,
      });
    }

    // Build the validation prompt
    let prompt = `# Pre-Commit Validation - Step ${step_number}/${total_steps}\n\n`;

    if (path) {
      prompt += `**Repository**: ${path}\n\n`;
    }

    if (step_number === 1) {
      prompt += `## Validation Strategy\n\n${step}\n\n`;
      prompt += `### Change Scope\n`;
      prompt += `- Staged changes: ${include_staged ? "✓ Included" : "✗ Excluded"}\n`;
      prompt += `- Unstaged changes: ${include_unstaged ? "✓ Included" : "✗ Excluded"}\n\n`;
      prompt += `### Validation Checklist\n`;
      prompt += `Analyze changes for:\n`;
      prompt += `- Code quality and correctness\n`;
      prompt += `- Security vulnerabilities\n`;
      prompt += `- Breaking changes\n`;
      prompt += `- Missing tests or documentation\n`;
      prompt += `- Accidental inclusion of sensitive data\n\n`;
    } else {
      prompt += `## Validation Progress\n\n${step}\n\n`;
    }

    prompt += `### Findings\n${findings}\n\n`;

    if (relevant_files.length > 0) {
      prompt += `### Files Under Review\n${relevant_files.map((f) => `- ${f}`).join("\n")}\n\n`;
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
            const location = issue.file ? ` [${issue.file}]` : "";
            prompt += `- ${issue.description}${location}\n`;
          }
        }
      }
      prompt += `\n`;
    }

    if (next_step_required) {
      prompt += `### Next Validation Phase\n`;
      prompt += `Continue validation by:\n`;
      prompt += `- Examining additional changes\n`;
      prompt += `- Checking for related issues\n`;
      prompt += `- Verifying completeness\n`;
    } else {
      prompt += `### Final Validation\n`;
      prompt += `Provide final assessment:\n`;
      prompt += `- Is the commit safe to proceed? (Yes/No with explanation)\n`;
      prompt += `- Critical blockers that must be addressed\n`;
      prompt += `- Recommendations before committing\n`;
      prompt += `- Suggested commit message if approved\n`;
    }

    // Add system message
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are a pre-commit validation expert. Analyze changes thoroughly to prevent bugs, security issues, and quality problems from being committed.`,
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
        temperature: 0.4, // Lower for validation consistency
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Pre-Commit Validation Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    responseText += `- Issues Found: ${issues_found.length}\n`;
    if (path) {
      responseText += `- Repository: ${path}\n`;
    }
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
