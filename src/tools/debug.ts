import {
  DebugInputSchema,
  type DebugInput,
  type ChatMessage,
} from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

export const debugTool = {
  name: "debug",
  description:
    "Performs systematic debugging and root cause analysis for any type of issue. Use for complex bugs, mysterious errors, performance issues, race conditions, memory leaks, and integration problems. Guides through structured investigation with hypothesis testing and expert analysis.",
  inputSchema: DebugInputSchema,

  async execute(
    input: DebugInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      findings,
      files_checked = [],
      relevant_files = [],
      relevant_context = [],
      hypothesis,
      confidence,
      backtrack_from_step,
      images = [],
      model,
      thinking_mode,
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "debug",
          model,
          thinking_mode,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "debug",
        model,
        thinking_mode,
      });
    }

    // Build the debugging prompt
    let prompt = `# Debug Investigation - Step ${step_number}/${total_steps}\n\n`;

    if (step_number === 1) {
      prompt += `## Initial Investigation\n\n${step}\n\n`;
    } else {
      prompt += `## Step ${step_number}\n\n${step}\n\n`;
    }

    prompt += `### Current Findings\n${findings}\n\n`;

    if (hypothesis) {
      prompt += `### Hypothesis\n${hypothesis}\n\n`;
      if (confidence) {
        prompt += `**Confidence Level**: ${confidence}\n\n`;
      }
    }

    if (files_checked.length > 0) {
      prompt += `### Files Examined\n${files_checked.map((f) => `- ${f}`).join("\n")}\n\n`;
    }

    if (relevant_files.length > 0) {
      prompt += `### Relevant Files\n${relevant_files.map((f) => `- ${f}`).join("\n")}\n\n`;
    }

    if (relevant_context.length > 0) {
      prompt += `### Relevant Context\n${relevant_context.map((c) => `- ${c}`).join("\n")}\n\n`;
    }

    if (backtrack_from_step) {
      prompt += `### Note\nBacktracking from step ${backtrack_from_step} to revise analysis.\n\n`;
    }

    prompt += `### Next Steps\n`;
    if (next_step_required) {
      prompt += `Continue investigation with step ${step_number + 1}. `;
      prompt += `Provide guidance on:\n`;
      prompt += `- What to investigate next\n`;
      prompt += `- Which files or code paths to examine\n`;
      prompt += `- What evidence to look for\n`;
      prompt += `- How to test the current hypothesis\n`;
    } else {
      prompt += `This is the final step. Provide:\n`;
      prompt += `- Summary of root cause analysis\n`;
      prompt += `- Concrete solution or fix recommendations\n`;
      prompt += `- Prevention strategies for similar issues\n`;
    }

    // Add system message for thinking mode
    if (messages.length === 0 && thinking_mode) {
      messages.push({
        role: "system",
        content: `You are a debugging expert operating in ${thinking_mode} thinking mode. Provide systematic analysis with appropriate depth for this mode.`,
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
        temperature: 0.7, // Balanced for debugging
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response with workflow context
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Debug Session Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    responseText += `- Continuation ID: ${convId}\n`;
    if (hypothesis) {
      responseText += `- Current Hypothesis: ${hypothesis}\n`;
    }
    if (confidence) {
      responseText += `- Confidence: ${confidence}\n`;
    }
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
