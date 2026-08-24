import { Client } from "pg";

export interface NodeRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface GraphData {
  nodes: NodeRow[];
  edges: EdgeRow[];
}

export interface AddNodeInput {
  type: string;
  name: string;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface AddEdgeInput {
  source_id: string;
  target_id: string;
  label: string;
  properties?: Record<string, unknown>;
}

/**
 * VaultService wraps all read/write access to the SynapseVault graph.
 *
 * Shared by both the MCP stdio server (agent tools) and the HTTP REST
 * surface (UI) so the two interfaces can never drift apart.
 */
export class VaultService {
  constructor(private readonly client: Client) {}

  async addNode(input: AddNodeInput): Promise<NodeRow> {
    const res = await this.client.query(
      "INSERT INTO nodes (type, name, description, properties) VALUES ($1, $2, $3, $4) RETURNING *",
      [
        input.type,
        input.name,
        input.description ?? "",
        JSON.stringify(input.properties ?? {}),
      ]
    );
    return res.rows[0];
  }

  async addEdge(input: AddEdgeInput): Promise<EdgeRow> {
    const res = await this.client.query(
      "INSERT INTO edges (source_id, target_id, label, properties) VALUES ($1, $2, $3, $4) RETURNING *",
      [
        input.source_id,
        input.target_id,
        input.label,
        JSON.stringify(input.properties ?? {}),
      ]
    );
    return res.rows[0];
  }

  async searchNodes(query?: string, type?: string): Promise<NodeRow[]> {
    // All values are bound as parameters - no string interpolation of user input.
    let sql = "SELECT * FROM nodes WHERE 1=1";
    const params: unknown[] = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";
    const res = await this.client.query(sql, params);
    return res.rows;
  }

  async getGraph(): Promise<GraphData> {
    const [nodes, edges] = await Promise.all([
      this.client.query("SELECT * FROM nodes ORDER BY created_at DESC"),
      this.client.query("SELECT * FROM edges"),
    ]);
    return { nodes: nodes.rows, edges: edges.rows };
  }
}