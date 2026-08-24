import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  onClose: () => void;
  /** Called when the agent mutated the graph so the UI can refetch. */
  onGraphChanged?: () => void;
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, onGraphChanged }) => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/chat/status`)
      .then((res) => res.json())
      .then((s) => setConfigured(s.configured === true))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      if ((data.actions ?? []).length > 0) onGraphChanged?.();
    } catch (err) {
      console.error('Chat failed:', err);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Sorry, the request failed. Is the chat feature configured on the API?',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg bg-black/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl flex flex-col h-[28rem]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          SynapseVault Architect
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-md"
          title="Close chat"
        >
          <X size={16} className="text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {configured === false && (
          <div className="text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
            Chat is disabled. Ask the API operator to set{' '}
            <code className="text-zinc-200">LLM_API_KEY</code> (a free Groq key
            from groq.com works) and restart the gateway.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-zinc-900 border border-zinc-800 text-zinc-200'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {busy && (
          <div className="self-start bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-500">
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 px-4 py-3 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            configured ? 'Ask me to add or find nodes...' : 'Chat disabled'
          }
          disabled={configured !== true || busy}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={configured !== true || busy || !input.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
