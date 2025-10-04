import { z } from "zod";
import {
  ChatInputSchema,
  type ChatInput,
  type ChatMessage,
} from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

export const chatTool = {
  name: "chat",
  description:
    "General chat and collaborative thinking partner for brainstorming, development discussion, getting second opinions, and exploring ideas. Use for ideas, validations, questions, and thoughtful explanations.",
  inputSchema: ChatInputSchema,

  async execute(
    input: ChatInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      prompt,
      files = [],
      images = [],
      model,
      temperature,
      thinking_mode,
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      const existingMessages = conversationMemory.getMessages(continuation_id);
      if (existingMessages.length > 0) {
        messages = [...existingMessages];
        convId = continuation_id;
      } else {
        // Invalid continuation_id, create new conversation
        convId = conversationMemory.create([], {
          model,
          thinking_mode,
        });
      }
    } else {
      convId = conversationMemory.create([], {
        model,
        thinking_mode,
      });
    }

    // Build context from files if provided
    let contextPrompt = prompt;
    if (files.length > 0) {
      const fileContext = files.map((f) => `File: ${f}`).join("\n");
      contextPrompt = `Context files:\n${fileContext}\n\n${prompt}`;
    }

    // Add system message for thinking mode if specified
    if (thinking_mode && messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are operating in ${thinking_mode} thinking mode. Adjust your reasoning depth accordingly:
- minimal: Quick, direct responses
- low: Basic reasoning
- medium: Moderate analysis
- high: Deep analysis with multiple perspectives
- max: Comprehensive reasoning with extensive exploration`,
      });
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: contextPrompt,
    };
    messages.push(userMessage);
    conversationMemory.addMessage(convId, userMessage);

    // Get response from Ollama
    const response = await ollama.chat({
      model,
      messages,
      options: {
        temperature,
      },
    });

    // Store assistant message
    conversationMemory.addMessage(convId, response.message);

    // Build response text with continuation info
    let responseText = response.message.content;

    if (!continuation_id) {
      responseText += `\n\n---\n*Conversation ID: ${convId}*\nUse this continuation_id to continue this conversation.`;
    }

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
