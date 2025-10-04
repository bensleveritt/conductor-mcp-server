import {
  ThinkDeepInputSchema,
  type ThinkDeepInput,
  type ChatMessage,
} from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

export const thinkdeepTool = {
  name: "thinkdeep",
  description:
    "Performs multi-stage investigation and reasoning for complex problem analysis. Use for architecture decisions, complex bugs, performance challenges, and security analysis. Provides systematic hypothesis testing, evidence-based investigation, and expert validation.",
  inputSchema: ThinkDeepInputSchema,

  async execute(
    input: ThinkDeepInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      findings,
      model,
      thinking_mode = "high",
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "thinkdeep",
          model,
          thinking_mode,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "thinkdeep",
        model,
        thinking_mode,
      });
    }

    // Build the deep thinking prompt
    let prompt = `# Deep Thinking Session - Step ${step_number}/${total_steps}\n\n`;

    // Thinking mode instructions
    const thinkingInstructions = {
      minimal: "Provide quick, focused analysis without extensive exploration.",
      low: "Basic reasoning with key considerations.",
      medium: "Moderate analysis covering main perspectives and implications.",
      high: "Deep analysis with multiple perspectives, edge cases, and implications.",
      max: "Comprehensive reasoning with extensive exploration of all angles, trade-offs, and long-term consequences.",
    };

    if (step_number === 1) {
      prompt += `## Problem/Question\n\n${step}\n\n`;
      prompt += `### Analysis Approach\n`;
      prompt += `**Thinking Mode**: ${thinking_mode} - ${thinkingInstructions[thinking_mode]}\n\n`;
      prompt += `Please provide an initial analysis considering:\n`;
      prompt += `- Core problem or question\n`;
      prompt += `- Key factors and constraints\n`;
      prompt += `- Potential approaches or angles to explore\n`;
      prompt += `- What needs deeper investigation\n\n`;
    } else {
      prompt += `## Continued Analysis\n\n${step}\n\n`;
    }

    prompt += `### Current Findings\n${findings}\n\n`;

    if (next_step_required) {
      prompt += `### Next Phase\n`;
      prompt += `This is an intermediate step. Continue the analysis by:\n`;
      prompt += `- Building on previous findings\n`;
      prompt += `- Exploring additional perspectives\n`;
      prompt += `- Identifying gaps or uncertainties\n`;
      prompt += `- Refining understanding\n`;
    } else {
      prompt += `### Final Synthesis\n`;
      prompt += `This is the final step. Provide:\n`;
      prompt += `- Comprehensive synthesis of all findings\n`;
      prompt += `- Clear conclusions or recommendations\n`;
      prompt += `- Trade-offs and considerations\n`;
      prompt += `- Action items or next steps\n`;
    }

    // Add system message for thinking mode
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are an expert analytical thinker operating in ${thinking_mode} mode. ${thinkingInstructions[thinking_mode]} Provide structured, evidence-based reasoning.`,
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
        temperature:
          thinking_mode === "minimal"
            ? 0.3
            : thinking_mode === "max"
              ? 0.8
              : 0.6,
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response with workflow context
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Deep Thinking Session Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    responseText += `- Thinking Mode: ${thinking_mode}\n`;
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
