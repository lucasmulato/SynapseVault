import type { VaultService } from "./vault.js";

/**
 * Optional zero-cost reasoning layer.
 *
 * Talks to any OpenAI-compatible chat-completions endpoint. Defaults to
 * Groq's free tier so the feature costs R$0 and runs entirely remotely
 * (no local RAM/GPU requirements). If no API key is configured the whole
 * feature is disabled and nothing is loaded.
 */
export interface ChatConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function chatConfigFromEnv(): ChatConfig | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
  };
}

const SYSTEM_PROMPT = `You are SynapseVault Architect, an assistant managing a personal knowledge graph.
The graph has nodes of type "idea", "project", "task" or "label", connected by edges
labelled "relates_to", "contains", "depends_on" or "tagged_with".
Use the provided tools to create or search nodes and edges when the user asks.
Be concise. Summarize what you did after using tools.`;

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "add_node",
      description: 'Create a node. type is one of "idea", "project", "task", "label".',
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["idea", "project", "task", "label"] },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["type", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_edge",
      description:
        'Connect two nodes. label is one of "relates_to", "contains", "depends_on", "tagged_with".',
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string" },
          target_id: { type: "string" },
          label: { type: "string", enum: ["relates_to", "contains", "depends_on", "tagged_with"] },
        },
        required: ["source_id", "target_id", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_nodes",
      description: "Search nodes by optional text query and/or node type.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          type: { type: "string" },
        },
      },
    },
  },
];

export interface ChatResult {
  reply: string;
  actions: string[];
}

export class GraphAgent {
  constructor(
    private readonly config: ChatConfig,
    private readonly vault: VaultService
  ) {}

  async chat(message: string): Promise<ChatResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ];
    const actions: string[] = [];

    // Bound the loop so a misbehaving model cannot spin forever.
    for (let i = 0; i < 6; i++) {
      const response = await this.completion(messages);
      const choice = response.choices?.[0]?.message;
      if (!choice) throw new Error("Malformed LLM response");

      const toolCalls = choice.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return { reply: choice.content ?? "", actions };
      }

      messages.push({
        role: "assistant",
        content: choice.content,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        let resultText: string;
        try {
          resultText = await this.runTool(call);
        } catch (err: any) {
          resultText = `Error: ${err.message}`;
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: resultText,
        });
      }
    }

    return {
      reply:
        "I hit the tool-call limit before finishing. Partial actions: " +
        (actions.length ? actions.join("; ") : "none"),
      actions,
    };
  }

  private async runTool(call: ToolCall): Promise<string> {
    const args = JSON.parse(call.function.arguments || "{}");
    switch (call.function.name) {
      case "add_node": {
        const row = await this.vault.addNode({
          type: args.type,
          name: args.name,
          description: args.description,
        });
        return JSON.stringify(row);
      }
      case "add_edge": {
        const row = await this.vault.addEdge({
          source_id: args.source_id,
          target_id: args.target_id,
          label: args.label,
        });
        return JSON.stringify(row);
      }
      case "search_nodes": {
        const rows = await this.vault.searchNodes(args.query, args.type);
        return JSON.stringify(rows);
      }
      default:
        throw new Error(`Unknown tool: ${call.function.name}`);
    }
  }

  private async completion(messages: ChatMessage[]): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools: TOOLS,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM API error ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  }
}
