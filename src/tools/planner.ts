import {
  PlannerInputSchema,
  type PlannerInput,
  type ChatMessage,
} from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";
import { conversationMemory } from "../utils/memory.ts";

export const plannerTool = {
  name: "planner",
  description:
    "Breaks down complex tasks through interactive, sequential planning with revision and branching capabilities. Use for complex project planning, system design, migration strategies, and architectural decisions. Builds plans incrementally with deep reflection for complex scenarios.",
  inputSchema: PlannerInputSchema,

  async execute(
    input: PlannerInput,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const {
      step,
      step_number,
      total_steps,
      next_step_required,
      is_step_revision = false,
      revises_step_number,
      is_branch_point = false,
      branch_id,
      branch_from_step,
      model,
      continuation_id,
    } = input;

    // Get or create conversation
    let messages: ChatMessage[] = [];
    let convId: string;

    if (continuation_id) {
      messages = conversationMemory.getMessages(continuation_id) || [];
      if (messages.length === 0) {
        convId = conversationMemory.create([], {
          tool: "planner",
          model,
        });
      } else {
        convId = continuation_id;
      }
    } else {
      convId = conversationMemory.create([], {
        tool: "planner",
        model,
      });
    }

    // Build the planning prompt
    let prompt = `# Planning Session - Step ${step_number}/${total_steps}\n\n`;

    // Handle different planning scenarios
    if (step_number === 1) {
      prompt += `## Project/Task Overview\n\n${step}\n\n`;
      prompt += `### Planning Approach\n`;
      prompt += `Please provide an initial plan covering:\n`;
      prompt += `- High-level goals and objectives\n`;
      prompt += `- Key phases or milestones\n`;
      prompt += `- Major components or tasks\n`;
      prompt += `- Dependencies and constraints\n`;
      prompt += `- Potential challenges\n\n`;
    } else if (is_step_revision && revises_step_number) {
      prompt += `## Plan Revision\n\n`;
      prompt += `Revising step ${revises_step_number}:\n\n${step}\n\n`;
      prompt += `### Revision Analysis\n`;
      prompt += `Provide updated analysis addressing:\n`;
      prompt += `- What changed and why\n`;
      prompt += `- Impact on subsequent steps\n`;
      prompt += `- Updated approach or recommendations\n\n`;
    } else if (is_branch_point && branch_id && branch_from_step) {
      prompt += `## Alternative Approach - Branch: ${branch_id}\n\n`;
      prompt += `Branching from step ${branch_from_step}:\n\n${step}\n\n`;
      prompt += `### Branch Exploration\n`;
      prompt += `Explore this alternative by:\n`;
      prompt += `- Describing the different approach\n`;
      prompt += `- Comparing with the main path\n`;
      prompt += `- Identifying unique benefits/risks\n`;
      prompt += `- Providing recommendations\n\n`;
    } else {
      prompt += `## Detailed Planning\n\n${step}\n\n`;
      prompt += `### Step ${step_number} Analysis\n`;
      prompt += `Continue planning by:\n`;
      prompt += `- Breaking down this phase\n`;
      prompt += `- Identifying specific tasks\n`;
      prompt += `- Noting dependencies\n`;
      prompt += `- Highlighting risks or concerns\n\n`;
    }

    if (next_step_required) {
      prompt += `### Next Planning Phase\n`;
      prompt += `Prepare for step ${step_number + 1} by identifying:\n`;
      prompt += `- What needs further breakdown\n`;
      prompt += `- Areas requiring more detail\n`;
      prompt += `- Open questions to address\n`;
    } else {
      prompt += `### Final Plan Summary\n`;
      prompt += `Provide a comprehensive plan summary including:\n`;
      prompt += `- Complete task breakdown\n`;
      prompt += `- Execution sequence\n`;
      prompt += `- Resource requirements\n`;
      prompt += `- Success criteria\n`;
      prompt += `- Risk mitigation strategies\n`;
    }

    // Add system message
    if (messages.length === 0) {
      messages.push({
        role: "system",
        content: `You are an expert project planner. Provide structured, actionable plans with clear breakdown of tasks, dependencies, and considerations.`,
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
        temperature: 0.6, // Balanced for planning
      },
    });

    // Store response
    conversationMemory.addMessage(convId, response.message);

    // Build response with workflow context
    let responseText = response.message.content;

    responseText += `\n\n---\n`;
    responseText += `**Planning Session Info**\n`;
    responseText += `- Step: ${step_number}/${total_steps}\n`;
    if (is_step_revision && revises_step_number) {
      responseText += `- Revision of step: ${revises_step_number}\n`;
    }
    if (is_branch_point && branch_id) {
      responseText += `- Branch: ${branch_id} (from step ${branch_from_step})\n`;
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
