import React, { useState, useEffect } from 'react';
import GraphView, { type GraphNode } from './components/GraphView';
import { Brain, Plus, Search, Settings, MessageSquare, X } from 'lucide-react';

interface NodeRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  properties?: Record<string, unknown>;
}

interface GraphData {
  nodes: NodeRow[];
  edges: { source_id: string; target_id: string; label: string }[];
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const App: React.FC = () => {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeRow | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'idea' | 'project' | 'task'>('idea');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/graph`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const graph: GraphData = await res.json();
        if (!cancelled) setData(graph);
      } catch (err) {
        console.error('Failed to load graph:', err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddNode(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          name: newName.trim(),
          description: newDesc.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: NodeRow = await res.json();
      setData((prev) =>
        prev ? { ...prev, nodes: [...prev.nodes, created] } : { nodes: [created], edges: [] }
      );
      setNewName('');
      setNewDesc('');
      setNewType('idea');
      setShowAdd(false);
    } catch (err) {
      console.error('Failed to add node:', err);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Navigation Sidebar */}
      <nav className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-8 bg-black">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
          <Brain size={24} className="text-white" />
        </div>
        <div className="flex flex-col gap-6">
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <Search size={24} />
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
            title="Add node"
          >
            <Plus size={24} />
          </button>
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <MessageSquare size={24} />
          </button>
        </div>
        <div className="mt-auto">
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <Settings size={24} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative">
        <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center pointer-events-none z-10">
          <div className="pointer-events-auto bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-zinc-800 shadow-xl">
            <h1 className="text-sm font-medium tracking-wider uppercase text-zinc-400">
              SynapseVault <span className="text-zinc-600 px-2">//</span>{' '}
              <span className="text-blue-400">Semantic Brain</span>
            </h1>
          </div>
        </header>

        {showAdd && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-md bg-black/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">Add New Node</h2>
            <form onSubmit={handleAddNode} className="flex flex-col gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="idea">Idea</option>
                <option value="project">Project</option>
                <option value="task">Task</option>
              </select>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !newName.trim()}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding...' : 'Add Node'}
                </button>
              </div>
            </form>
          </div>
        )}

        <GraphView
          data={data}
          onNodeClick={(node: GraphNode) => {
            setSelectedNode({
              id: node.id,
              name: node.name,
              type: node.type,
              description: null,
            });
            setSidebarOpen(true);
          }}
        />
      </main>

      {/* Detail Sidebar */}
      {isSidebarOpen && selectedNode && (
        <aside className="w-96 border-l border-zinc-800 bg-black/90 backdrop-blur-xl p-8 flex flex-col gap-6 animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-start">
            <div className="px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {selectedNode.type}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <X size={20} className="text-zinc-500" />
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">{selectedNode.name}</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">
              {selectedNode.description || 'No description provided.'}
            </p>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Properties
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="text-zinc-500 mb-1">ID</div>
                <div className="font-mono text-zinc-300 truncate">
                  {selectedNode.id}
                </div>
              </div>
              <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="text-zinc-500 mb-1">Created</div>
                <div className="text-zinc-300">
                  {selectedNode.properties?.created_at
                    ? new Date(selectedNode.properties.created_at as string).toLocaleDateString()
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-zinc-900">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
              Edit Node
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;