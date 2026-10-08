import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
} from 'reactflow';

const PORT_TYPES = {
  text: { color: '#22d3ee', label: 'Text' },
  image: { color: '#a855f7', label: 'Image' },
  video: { color: '#4ade80', label: 'Video' },
  audio: { color: '#ec4899', label: 'Audio' },
  any: { color: '#6b7280', label: 'Any' },
};

function portTypesMatch(sourceType, targetType) {
  if (sourceType === 'any' || targetType === 'any') return true;
  return sourceType === targetType;
}

let nodeIdCounter = 0;
function nextId() {
  return `node_${++nodeIdCounter}_${Date.now()}`;
}

const NODE_TEMPLATES = {
  'text-input': {
    label: 'Text Input',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'text', type: 'text', label: 'Text' }],
    params: { text: { type: 'textarea', default: '', label: 'Text' } },
  },
  'file-input': {
    label: 'File Input',
    category: 'input',
    inputs: [],
    outputs: [
      { id: 'image', type: 'image', label: 'Image URL' },
      { id: 'audio', type: 'audio', label: 'Audio URL' },
    ],
    params: { url: { type: 'string', default: '', label: 'File URL' } },
  },
  'generate-image': {
    label: 'Generate Image',
    category: 'generation',
    inputs: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'image', type: 'image', label: 'Image' }],
    params: {
      model: { type: 'select', options: ['nano-banana-2', 'nano-banana-pro', 'seedream-5-pro-t2i', 'gpt-image-2-t2i', 'flux-kontext', 'qwen-image-2-1'], default: 'nano-banana-2', label: 'Model' },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1', label: 'Aspect Ratio' },
    },
  },
  'edit-image': {
    label: 'Edit Image',
    category: 'generation',
    inputs: [
      { id: 'prompt', type: 'text', label: 'Prompt' },
      { id: 'image', type: 'image', label: 'Source Image' },
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Image' }],
    params: {
      model: { type: 'select', options: ['gpt-image-2-i2i', 'flux-kontext-edit', 'qwen-image-i2i'], default: 'gpt-image-2-i2i', label: 'Model' },
    },
  },
  'generate-video': {
    label: 'Generate Video',
    category: 'generation',
    inputs: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }],
    params: {
      model: { type: 'select', options: ['kling-2-6-t2v', 'veo-3-1-t2v', 'runway-t2v', 'seedance-2-5-t2v', 'wan-3-0-t2v'], default: 'kling-2-6-t2v', label: 'Model' },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1'], default: '16:9', label: 'Aspect Ratio' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
    },
  },
  'image-to-video': {
    label: 'Image to Video',
    category: 'generation',
    inputs: [
      { id: 'prompt', type: 'text', label: 'Prompt' },
      { id: 'image', type: 'image', label: 'Start Frame' },
    ],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }],
    params: {
      model: { type: 'select', options: ['kling-2-6-i2v', 'veo-3-1-i2v', 'runway-i2v', 'seedance-2-5-i2v'], default: 'kling-2-6-i2v', label: 'Model' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
    },
  },
  'lip-sync': {
    label: 'Lip Sync',
    category: 'generation',
    inputs: [
      { id: 'image', type: 'image', label: 'Portrait' },
      { id: 'audio', type: 'audio', label: 'Audio' },
    ],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }],
    params: {
      model: { type: 'select', options: ['omnihuman-1-5', 'volcengine-lipsync'], default: 'omnihuman-1-5', label: 'Model' },
    },
  },
  'generate-audio': {
    label: 'Generate Audio',
    category: 'generation',
    inputs: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'audio', type: 'audio', label: 'Audio' }],
    params: {
      model: { type: 'select', options: ['suno-v5-5', 'elevenlabs-tts', 'gemini-flash-tts'], default: 'suno-v5-5', label: 'Model' },
    },
  },
  'output': {
    label: 'Output',
    category: 'output',
    inputs: [
      { id: 'result', type: 'any', label: 'Result' },
    ],
    outputs: [],
    params: { label: { type: 'string', default: 'Output', label: 'Label' } },
  },
};

const useWorkflowStore = create((set, get) => ({
  nodes: [],
  edges: [],
  nodeResults: {},
  nodeStatus: {},
  isRunning: false,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return;

    const sourcePort = sourceNode.data.outputs?.find(p => p.id === connection.sourceHandle);
    const targetPort = targetNode.data.inputs?.find(p => p.id === connection.targetHandle);
    if (!sourcePort || !targetPort) return;

    if (!portTypesMatch(sourcePort.type, targetPort.type)) return;

    const existing = edges.find(
      e => e.target === connection.target && e.targetHandle === connection.targetHandle
    );
    let newEdges = edges;
    if (existing) {
      newEdges = edges.filter(e => e.id !== existing.id);
    }

    set({
      edges: rfAddEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          style: { stroke: PORT_TYPES[sourcePort.type]?.color || '#6b7280', strokeWidth: 2 },
        },
        newEdges
      ),
    });
  },

  addNode: (templateId, position) => {
    const template = NODE_TEMPLATES[templateId];
    if (!template) return;

    const id = nextId();
    const paramValues = {};
    if (template.params) {
      for (const [k, v] of Object.entries(template.params)) {
        paramValues[k] = v.default !== undefined ? v.default : '';
      }
    }

    const newNode = {
      id,
      type: 'workflowNode',
      position: position || { x: 250, y: 250 },
      data: {
        templateId,
        label: template.label,
        category: template.category,
        inputs: template.inputs,
        outputs: template.outputs,
        paramDefs: template.params,
        paramValues,
      },
    };

    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeParam: (nodeId, key, value) => {
    set({
      nodes: get().nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, paramValues: { ...n.data.paramValues, [key]: value } } }
          : n
      ),
    });
  },

  setNodeStatus: (nodeId, status) => {
    set({ nodeStatus: { ...get().nodeStatus, [nodeId]: status } });
  },

  setNodeResult: (nodeId, result) => {
    set({ nodeResults: { ...get().nodeResults, [nodeId]: result } });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    });
  },

  clearWorkflow: () => {
    set({ nodes: [], edges: [], nodeResults: {}, nodeStatus: {}, isRunning: false });
  },

  setIsRunning: (v) => set({ isRunning: v }),
}));

export { PORT_TYPES, NODE_TEMPLATES, useWorkflowStore };
