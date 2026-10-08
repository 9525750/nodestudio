'use client';

import { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflowStore } from '@/lib/workflowStore';
import { runWorkflow } from '@/lib/workflowRunner';
import WorkflowNode from '@/components/workflow/WorkflowNode';
import NodePalette from '@/components/workflow/NodePalette';

const nodeTypes = { workflowNode: WorkflowNode };

function WorkflowCanvas({ apiKey }) {
  const {
    nodes, edges, isRunning,
    onNodesChange, onEdgesChange, onConnect,
    addNode, clearWorkflow, setIsRunning,
  } = useWorkflowStore();

  const store = useWorkflowStore;
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [error, setError] = useState(null);

  const handleAddNode = useCallback((templateId) => {
    const pos = reactFlowInstance
      ? reactFlowInstance.project({ x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 })
      : { x: 400 + Math.random() * 200, y: 200 + Math.random() * 200 };
    addNode(templateId, pos);
  }, [addNode, reactFlowInstance]);

  const handleRun = async () => {
    if (!apiKey || isRunning) return;
    setError(null);
    try {
      await runWorkflow(apiKey, nodes, edges, store.getState());
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-full">
      <NodePalette onAdd={handleAddNode} />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-[#030303]/60">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={isRunning || nodes.length === 0}
              className="px-4 py-1.5 bg-[#4ade80] text-black text-xs font-bold rounded hover:bg-[#e5ff33] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isRunning ? 'Running...' : '▶ Run'}
            </button>
            <button
              onClick={clearWorkflow}
              disabled={isRunning}
              className="px-3 py-1.5 text-[11px] text-white/30 hover:text-red-400 border border-white/[0.04] rounded transition-colors"
            >
              Clear
            </button>
            <span className="text-[10px] text-white/15">{nodes.length} nodes / {edges.length} edges</span>
          </div>
          {error && (
            <div className="text-xs text-red-400 max-w-md truncate">{error}</div>
          )}
        </div>

        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            snapToGrid
            snapGrid={[16, 16]}
            proOptions={{ hideAttribution: true }}
            className="bg-[#030303]"
          >
            <Background color="#ffffff06" gap={32} size={1} />
            <Controls className="!bg-[#0a0a0a] !border-white/[0.06] !rounded-lg [&>button]:!bg-[#0a0a0a] [&>button]:!border-white/[0.06] [&>button]:!text-white/40 [&>button:hover]:!bg-white/5" />
            <MiniMap
              nodeColor={(n) => {
                const cat = n.data?.category;
                if (cat === 'input') return '#22d3ee';
                if (cat === 'output') return '#4ade80';
                return '#a855f7';
              }}
              maskColor="rgba(0,0,0,0.8)"
              className="!bg-[#0a0a0a] !border-white/[0.04] rounded-lg"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowStudio({ apiKey }) {
  return (
    <div className="h-[calc(100vh-120px)] rounded-lg border border-white/[0.04] overflow-hidden">
      <ReactFlowProvider>
        <WorkflowCanvas apiKey={apiKey} />
      </ReactFlowProvider>
    </div>
  );
}
