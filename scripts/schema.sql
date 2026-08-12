-- SynapseVault: Local PostgreSQL Graph Schema
-- optimized for "Second Brain" interrelations

-- 1. Nodes Table: Stores Ideas, Projects, Tasks
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'idea', 'project', 'task', 'label'
    name TEXT NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}', -- flexible metadata (status, priority, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Edges Table: Stores relationships
CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- 'relates_to', 'contains', 'depends_on', 'tagged_with'
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate edges of the same type between same nodes
    CONSTRAINT unique_edge UNIQUE (source_id, target_id, label)
);

-- 3. Indexes for fast traversal
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_nodes_properties ON nodes USING GIN (properties);

-- 4. Audit Trigger (Optional but good practice)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_nodes_update
BEFORE UPDATE ON nodes
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
