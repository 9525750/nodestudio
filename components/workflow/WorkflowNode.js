'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { PORT_TYPES, useWorkflowStore } from '@/lib/workflowStore';

const CATEGORY_COLORS = {
  input: { border: '#22d3ee', bg: 'rgba(34,211,238,0.05)', header: 'rgba(34,211,238,0.12)' },
  generation: { border: '#a855f7', bg: 'rgba(168,85,247,0.05)', header: 'rgba(168,85,247,0.12)' },
  output: { border: '#4ade80', bg: 'rgba(74,222,128,0.05)', header: 'rgba(74,222,128,0.12)' },
};

const STATUS_INDICATOR = {
  idle: null,
  queued: { color: '#e5ff33', label: 'Queued', pulse: true },
  running: { color: '#22d3ee', label: 'Running', pulse: true },
  done: { color: '#4ade80', label: 'Done', pulse: false },
  error: { color: '#ef4444', label: 'Error', pulse: false },
};

function WorkflowNode({ id, data, selected }) {
  const updateNodeParam = useWorkflowStore(s => s.updateNodeParam);
  const removeNode = useWorkflowStore(s => s.removeNode);
  const nodeStatus = useWorkflowStore(s => s.nodeStatus[id]);
  const nodeResult = useWorkflowStore(s => s.nodeResults[id]);

  const colors = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.generation;
  const statusInfo = STATUS_INDICATOR[nodeStatus] || null;

  return (
    <div
      className="rounded-lg overflow-hidden min-w-[220px] max-w-[280px] text-xs"
      style={{
        border: `1px solid ${selected ? colors.border : 'rgba(255,255,255,0.06)'}`,
        background: colors.bg,
        boxShadow: selected ? `0 0 20px ${colors.border}40` : 'none',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ background: colors.header }}>
        <div className="flex items-center gap-2">
          {statusInfo && (
            <span
              className={`w-2 h-2 rounded-full inline-block ${statusInfo.pulse ? 'animate-pulse' : ''}`}
              style={{ background: statusInfo.color }}
            />
          )}
          <span className="font-semibold text-white text-[11px] uppercase tracking-wider">{data.label}</span>
        </div>
        <button
          onClick={() => removeNode(id)}
          className="text-white/20 hover:text-red-400 text-[10px] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="px-3 py-2 space-y-2">
        {data.paramDefs && Object.entries(data.paramDefs).map(([key, def]) => (
          <div key={key}>
            <label className="block text-[10px] text-white/30 mb-0.5">{def.label || key}</label>
            {def.type === 'select' ? (
              <select
                value={data.paramValues?.[key] ?? def.default ?? ''}
                onChange={e => updateNodeParam(id, key, e.target.value)}
                className="w-full bg-black/30 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30 focus:outline-none"
              >
                {def.options?.map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>)}
              </select>
            ) : def.type === 'textarea' ? (
              <textarea
                value={data.paramValues?.[key] ?? ''}
                onChange={e => updateNodeParam(id, key, e.target.value)}
                rows={2}
                className="w-full bg-black/30 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-white/10 focus:ring-1 focus:ring-[#22d3ee]/30 focus:outline-none resize-none"
                placeholder={def.label}
              />
            ) : def.type === 'boolean' ? (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!data.paramValues?.[key]}
                  onChange={e => updateNodeParam(id, key, e.target.checked)}
                  className="rounded border-white/10 bg-black/30"
                />
                <span className="text-[11px] text-white/50">{def.label}</span>
              </label>
            ) : (
              <input
                type="text"
                value={data.paramValues?.[key] ?? ''}
                onChange={e => updateNodeParam(id, key, e.target.value)}
                className="w-full bg-black/30 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-white/10 focus:ring-1 focus:ring-[#22d3ee]/30 focus:outline-none"
                placeholder={def.label}
              />
            )}
          </div>
        ))}

        {nodeResult?.url && (
          <div className="mt-1 pt-1 border-t border-white/5">
            {nodeResult.urls?.[0]?.match(/\.(mp4|webm|mov)/) ? (
              <video src={nodeResult.url} controls className="w-full rounded" />
            ) : nodeResult.urls?.[0]?.match(/\.(mp3|wav|ogg|flac)/) ? (
              <audio src={nodeResult.url} controls className="w-full" />
            ) : (
              <img src={nodeResult.url} alt="result" className="w-full rounded" />
            )}
          </div>
        )}
      </div>

      {data.inputs?.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${40 + i * 24}px`,
            background: PORT_TYPES[port.type]?.color || '#6b7280',
            width: 10,
            height: 10,
            border: '2px solid #030303',
          }}
          title={`${port.label} (${PORT_TYPES[port.type]?.label || port.type})`}
        />
      ))}

      {data.outputs?.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            top: `${40 + i * 24}px`,
            background: PORT_TYPES[port.type]?.color || '#6b7280',
            width: 10,
            height: 10,
            border: '2px solid #030303',
          }}
          title={`${port.label} (${PORT_TYPES[port.type]?.label || port.type})`}
        />
      ))}
    </div>
  );
}

export default memo(WorkflowNode);
