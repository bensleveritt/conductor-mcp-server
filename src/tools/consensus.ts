import {
  ConsensusInputSchema,
  type ConsensusInput,
  type ChatMessage,
} from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

export const consensusTool = {
  name: "consensus",
  description:
    "Builds multi-model consensus through systematic analysis and structured debate. Use for complex decisions, architectural choices, feature proposals, and technology evaluations. Consults multiple models with different stances to synthesize comprehensive recommendations.",
  inputSchema: ConsensusInputSchema,

  async execute(
    input: ConsensusInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      findings,
      models: modelConfigs,
      current_model_index = 0,
      model_responses = [],
      relevant_files = [],
      images = [],
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "consensus",
          models: modelConfigs,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "consensus",
        models: modelConfigs,
      });
    }

    // Build the consensus prompt
    let prompt = `# Multi-Model Consensus - Step ${step_number}/${total_steps}\n\n`;

    if (step_number === 1) {
      // Initial analysis step
      prompt += `## Proposal/Question\n\n${step}\n\n`;
      prompt += `### Models to Consult\n`;
      for (const config of modelConfigs) {
        const stanceText = config.stance ? ` (stance: ${config.stance})` : "";
        prompt += `- ${config.model}${stanceText}\n`;
      }
      prompt += `\n### Your Initial Analysis\n`;
      prompt += `Before consulting other models, provide your own analysis:\n`;
      prompt += `- Key considerations\n`;
      prompt += `- Potential approaches\n`;
      prompt += `- Important factors to evaluate\n\n`;
      prompt += `**Your Findings**: ${findings}\n`;
    } else if (current_model_index < modelConfigs.length) {
      // Consulting a specific model
      const currentModelConfig = modelConfigs[current_model_index];
      const modelName = currentModelConfig?.model || "unknown";
      const stance = currentModelConfig?.stance || "neutral";
      const stancePrompt = currentModelConfig?.stance_prompt;

      prompt += `## Consulting Model: ${modelName}\n\n`;
      prompt += `**Stance**: ${stance}\n\n`;
      prompt += `**Question/Proposal**: ${step}\n\n`;

      if (stancePrompt) {
        prompt += `**Perspective**: ${stancePrompt}\n\n`;
      } else if (stance === "for") {
        prompt += `**Perspective**: Evaluate this from a supportive perspective, highlighting benefits and opportunities.\n\n`;
      } else if (stance === "against") {
        prompt += `**Perspective**: Evaluate this critically, identifying risks, challenges, and drawbacks.\n\n`;
      } else {
        prompt += `**Perspective**: Provide a balanced, objective analysis.\n\n`;
      }

      if (relevant_files.length > 0) {
        prompt += `**Context Files**:\n${relevant_files.map((f) => `- ${f}`).join("\n")}\n\n`;
      }

      // Include previous responses for context
      if (model_responses.length > 0) {
        prompt += `### Previous Perspectives\n`;
        for (const resp of model_responses) {
          prompt += `**${resp.model}** (${resp.stance}): ${resp.summary}\n\n`;
        }
      }

      prompt += `Provide this model's perspective focusing on:\n`;
      prompt += `- Key arguments from the ${stance} stance\n`;
      prompt += `- Supporting evidence or reasoning\n`;
      prompt += `- Important considerations\n\n`;
      prompt += `**Latest Findings**: ${findings}\n`;
    } else {
      // Final synthesis step
      prompt += `## Consensus Synthesis\n\n`;
      prompt += `**Original Question**: ${step}\n\n`;
      prompt += `### All Perspectives Gathered\n`;
      for (const resp of model_responses) {
        prompt += `\n**${resp.model}** (${resp.stance}):\n${resp.summary}\n`;
      }
      prompt += `\n### Your Final Synthesis\n`;
      prompt += `Based on all perspectives, provide:\n`;
      prompt += `- Areas of agreement across models\n`;
      prompt += `- Key points of disagreement\n`;
      prompt += `- Balanced recommendation\n`;
      prompt += `- Action items or next steps\n\n`;
      prompt += `**Synthesis**: ${findings}\n`;
    }

    // Determine which model to use
    let modelToUse: string;
    if (step_number === 1 || current_model_index >= modelConfigs.length) {
      // Use default model for initial analysis and synthesis
      modelToUse = "qwen2.5:latest";
    } else {
      // Use the specific model being consulted
      modelToUse = modelConfigs[current_model_index]?.model || "qwen2.5:latest";
    }

    // Add system message
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are facilitating a multi-model consensus process. Provide structured, evidence-based analysis and help synthesize diverse perspectives.`,
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
      model: modelToUse,
      messages,
      options: {
        temperature: 0.7,
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response with workflow context
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Consensus Session Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    if (current_model_index < modelConfigs.length) {
      const currentConfig = modelConfigs[current_model_index];
      responseText += `- Current Model: ${currentConfig?.model} (${currentConfig?.stance || "neutral"})\n`;
      responseText += `- Progress: ${current_model_index + 1}/${modelConfigs.length} models consulted\n`;
    } else {
      responseText += `- Phase: Final synthesis\n`;
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
