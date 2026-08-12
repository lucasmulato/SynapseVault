import React, { useState, useEffect } from 'react';
import GraphView from './components/GraphView';
import { Brain, Plus, Search, Settings, MessageSquare, X } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: string;
  description?: string;
  properties?: any;
}

const App: React.FC = () => {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Initial mock data for development
  useEffect(() => {
    const mockNodes = [
      { id: '1', name: 'SynapseVault Project', type: 'project', description: 'Personal Knowledge Graph system' },
      { id: '2', name: 'Local-First Pivot', type: 'idea', description: 'Switch from GCP to Local Postgres' },
      { id: '3', name: 'Implement D3 Graph', type: 'task', description: 'Build the visualization layer' },
      { id: '4', name: 'MCP Integration', type: 'task', description: 'Connect agent to DB' },
    ];
    const mockEdges = [
      { source: '1', target: '2', label: 'relates_to' },
      { source: '1', target: '3', label: 'contains' },
      { source: '1', target: '4', label: 'contains' },
    ];
    setData({ nodes: mockNodes, edges: mockEdges } as any);
  }, []);

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
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
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
              SynapseVault <span className="text-zinc-600 px-2">//</span> 
              <span className="text-blue-400">Semantic Brain</span>
            </h1>
          </div>
        </header>

        <GraphView 
          data={data} 
          onNodeClick={(node) => {
            setSelectedNode(node);
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
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Properties</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="text-zinc-500 mb-1">ID</div>
                <div className="font-mono text-zinc-300 truncate">{selectedNode.id}</div>
              </div>
              <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="text-zinc-500 mb-1">Created</div>
                <div className="text-zinc-300">Aug 12, 2026</div>
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
