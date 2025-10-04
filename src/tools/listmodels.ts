import { ListModelsInputSchema } from "../types/index.ts";
import { ollama } from "../utils/ollama-client.ts";

export const listmodelsTool = {
  name: "listmodels",
  description: "Shows available Ollama models, their names, and capabilities.",
  inputSchema: ListModelsInputSchema,

  async execute(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const models = await ollama.listModels();

      if (models.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No models found. Make sure Ollama is running and has models installed.\n\nTo install a model, run: `ollama pull <model-name>`",
            },
          ],
        };
      }

      // Format models as a nice table
      const modelInfo = models
        .map((model) => {
          const size = (model.size / (1024 ** 3)).toFixed(2); // Convert to GB
          const family = model.details?.family || "unknown";
          const paramSize = model.details?.parameter_size || "unknown";

          return {
            name: model.name,
            family,
            size: `${size} GB`,
            parameters: paramSize,
            modified: new Date(model.modified_at).toLocaleDateString(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // Create formatted output
      let output = "# Available Ollama Models\n\n";
      output += `Found ${models.length} model(s):\n\n`;

      for (const model of modelInfo) {
        output += `## ${model.name}\n`;
        output += `- **Family**: ${model.family}\n`;
        output += `- **Parameters**: ${model.parameters}\n`;
        output += `- **Size**: ${model.size}\n`;
        output += `- **Last Modified**: ${model.modified}\n\n`;
      }

      output += "\n---\nUse any model name in the `model` parameter for other tools.";

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching models: ${errorMessage}\n\nMake sure Ollama is running at ${ollama["baseUrl"]}`,
          },
        ],
      };
    }
  },
};
