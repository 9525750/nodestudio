'use client';

import { NODE_TEMPLATES, PORT_TYPES } from '@/lib/workflowStore';

const CATEGORIES = [
  { id: 'input', label: 'Inputs', color: '#22d3ee' },
  { id: 'generation', label: 'Generation', color: '#a855f7' },
  { id: 'output', label: 'Output', color: '#4ade80' },
];

export default function NodePalette({ onAdd }) {
  return (
    <div className="w-56 border-r border-white/[0.04] bg-[#030303]/80 overflow-y-auto flex-shrink-0">
      <div className="p-3">
        <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3">Nodes</h3>
        {CATEGORIES.map(cat => {
          const items = Object.entries(NODE_TEMPLATES).filter(([, t]) => t.category === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} className="mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: cat.color + '80' }}>
                {cat.label}
              </div>
              <div className="space-y-1">
                {items.map(([id, template]) => (
                  <button
                    key={id}
                    onClick={() => onAdd(id)}
                    className="w-full text-left px-2.5 py-2 rounded-md border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                  >
                    <div className="text-[11px] font-medium text-white/70 group-hover:text-white transition-colors">
                      {template.label}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {template.inputs?.map(p => (
                        <span key={p.id} className="w-1.5 h-1.5 rounded-full" style={{ background: PORT_TYPES[p.type]?.color }} title={`In: ${p.label}`} />
                      ))}
                      {template.inputs?.length > 0 && template.outputs?.length > 0 && (
                        <span className="text-white/10 text-[8px]">→</span>
                      )}
                      {template.outputs?.map(p => (
                        <span key={p.id} className="w-1.5 h-1.5 rounded-full" style={{ background: PORT_TYPES[p.type]?.color }} title={`Out: ${p.label}`} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
