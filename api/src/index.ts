import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "pg";
import http from "node:http";
import { VaultService } from "./services/vault.js";

// 1. Database Connection
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/synapsevault";
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

// 2. Shared service - used by both MCP and HTTP so they can't drift apart
const vault = new VaultService(client);

// 3. MCP Server Setup
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

// 4. Define Tools
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
            label: {
              type: "string",
              enum: ["relates_to", "contains", "depends_on", "tagged_with"],
            },
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

// 5. Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_node": {
        const { type, name, description, properties } = args as any;
        const row = await vault.addNode({
          type,
          name,
          description,
          properties,
        });
        return { content: [{ type: "text", text: JSON.stringify(row) }] };
      }

      case "add_edge": {
        const { source_id, target_id, label, properties } = args as any;
        const row = await vault.addEdge({
          source_id,
          target_id,
          label,
          properties,
        });
        return { content: [{ type: "text", text: JSON.stringify(row) }] };
      }

      case "search_nodes": {
        const { query, type } = args as any;
        const rows = await vault.searchNodes(query, type);
        return { content: [{ type: "text", text: JSON.stringify(rows) }] };
      }

      case "get_graph_data": {
        const graph = await vault.getGraph();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(graph),
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

// 6. HTTP REST surface for the UI
function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && path === "/api/graph") {
      const graph = await vault.getGraph();
      sendJson(res, 200, graph);
      return;
    }

    if (req.method === "GET" && path === "/api/search") {
      const query = url.searchParams.get("query") ?? undefined;
      const type = url.searchParams.get("type") ?? undefined;
      const rows = await vault.searchNodes(query, type);
      sendJson(res, 200, rows);
      return;
    }

    if (req.method === "POST" && path === "/api/nodes") {
      const body = (await readBody(req)) as any;
      const row = await vault.addNode(body);
      sendJson(res, 201, row);
      return;
    }

    if (req.method === "POST" && path === "/api/edges") {
      const body = (await readBody(req)) as any;
      const row = await vault.addEdge(body);
      sendJson(res, 201, row);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err: any) {
    const status = err.code === "23503" ? 409 : 400; // FK violation -> conflict
    sendJson(res, status, { error: err.message });
  }
}

// 7. Start Server
async function main() {
  await connectDb();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SynapseVault MCP Server running on stdio");

  const httpPort = process.env.HTTP_PORT ?? "3000";
  const httpServer = http.createServer(handleHttp);
  httpServer.listen(Number(httpPort), () => {
    console.error(`SynapseVault HTTP API running on http://localhost:${httpPort}`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});