import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "pg";

// 1. Database Connection
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/synapsevault";
const client = new Client({ connectionString: DATABASE_URL });

async function connectDb() {
  try {
    await client.connect();
    console.error("Connected to PostgreSQL");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }
}

// 2. MCP Server Setup
const server = new Server(
  {
    name: "synapse-vault-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 3. Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_node",
        description: "Add a new node (Idea, Project, Task, Label) to SynapseVault",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["idea", "project", "task", "label"] },
            name: { type: "string" },
            description: { type: "string" },
            properties: { type: "object" },
          },
          required: ["type", "name"],
        },
      },
      {
        name: "add_edge",
        description: "Connect two existing nodes with a relationship",
        inputSchema: {
          type: "object",
          properties: {
            source_id: { type: "string", format: "uuid" },
            target_id: { type: "string", format: "uuid" },
            label: { type: "string", enum: ["relates_to", "contains", "depends_on", "tagged_with"] },
            properties: { type: "object" },
          },
          required: ["source_id", "target_id", "label"],
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes by name or type",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            type: { type: "string" },
          },
        },
      },
      {
        name: "get_graph_data",
        description: "Get the full graph (nodes and edges) for visualization",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

// 4. Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_node": {
        const { type, name, description, properties } = args as any;
        const res = await client.query(
          "INSERT INTO nodes (type, name, description, properties) VALUES ($1, $2, $3, $4) RETURNING *",
          [type, name, description || "", JSON.stringify(properties || {})]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows[0]) }] };
      }

      case "add_edge": {
        const { source_id, target_id, label, properties } = args as any;
        const res = await client.query(
          "INSERT INTO edges (source_id, target_id, label, properties) VALUES ($1, $2, $3, $4) RETURNING *",
          [source_id, target_id, label, JSON.stringify(properties || {})]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows[0]) }] };
      }

      case "search_nodes": {
        const { query, type } = args as any;
        let sql = "SELECT * FROM nodes WHERE 1=1";
        const params = [];
        if (query) {
          sql += " AND (name ILIKE $1 OR description ILIKE $1)";
          params.push(`%${query}%`);
        }
        if (type) {
          sql += ` AND type = $${params.length + 1}`;
          params.push(type);
        }
        const res = await client.query(sql, params);
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "get_graph_data": {
        const nodes = await client.query("SELECT * FROM nodes");
        const edges = await client.query("SELECT * FROM edges");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ nodes: nodes.rows, edges: edges.rows }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// 5. Start Server
async function main() {
  await connectDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SynapseVault MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
