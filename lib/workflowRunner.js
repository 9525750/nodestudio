import {
  t2iModels, i2iModels, t2vModels, i2vModels,
  lipSyncModels, audioModels, getModelById,
} from './models';
import {
  generateImage, generateI2I, generateVideo, generateI2V,
  processLipSync, generateAudio,
} from './kie';

function topologicalSort(nodes, edges) {
  const adj = new Map();
  const inDeg = new Map();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }

  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    for (const next of adj.get(id) || []) {
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Workflow contains a cycle');
  }

  return sorted;
}

function resolveInputs(nodeId, nodeData, edges, nodeResults) {
  const resolved = {};
  const incomingEdges = edges.filter(e => e.target === nodeId);

  for (const edge of incomingEdges) {
    const sourceResult = nodeResults[edge.source];
    if (!sourceResult) continue;

    const targetPort = edge.targetHandle;
    const sourcePort = edge.sourceHandle;

    if (sourcePort === 'text' && sourceResult.text !== undefined) {
      resolved[targetPort] = sourceResult.text;
    } else if (sourcePort === 'image' && sourceResult.url) {
      resolved[targetPort] = sourceResult.url;
    } else if (sourcePort === 'video' && sourceResult.url) {
      resolved[targetPort] = sourceResult.url;
    } else if (sourcePort === 'audio' && sourceResult.url) {
      resolved[targetPort] = sourceResult.url;
    } else if (sourceResult.url) {
      resolved[targetPort] = sourceResult.url;
    }
  }

  return resolved;
}

async function executeNode(apiKey, node, inputs, onStatus) {
  const { templateId, paramValues } = node.data;

  if (templateId === 'text-input') {
    return { text: paramValues.text || '', url: null };
  }

  if (templateId === 'file-input') {
    return { url: paramValues.url || null, text: paramValues.url || '' };
  }

  if (templateId === 'output') {
    const resultUrl = inputs.result;
    return { url: resultUrl || null };
  }

  const modelId = paramValues.model;

  if (templateId === 'generate-image') {
    const modelDef = getModelById(t2iModels, modelId);
    return generateImage(apiKey, {
      prompt: inputs.prompt || paramValues.prompt || '',
      model: modelId,
      _modelDef: modelDef,
      aspect_ratio: paramValues.aspect_ratio,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  if (templateId === 'edit-image') {
    const modelDef = getModelById(i2iModels, modelId);
    return generateI2I(apiKey, {
      prompt: inputs.prompt || '',
      image_url: inputs.image || '',
      model: modelId,
      _modelDef: modelDef,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  if (templateId === 'generate-video') {
    const modelDef = getModelById(t2vModels, modelId);
    return generateVideo(apiKey, {
      prompt: inputs.prompt || '',
      model: modelId,
      _modelDef: modelDef,
      aspect_ratio: paramValues.aspect_ratio,
      duration: paramValues.duration,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  if (templateId === 'image-to-video') {
    const modelDef = getModelById(i2vModels, modelId);
    return generateI2V(apiKey, {
      prompt: inputs.prompt || '',
      image_url: inputs.image || '',
      images_list: inputs.image ? [inputs.image] : undefined,
      model: modelId,
      _modelDef: modelDef,
      duration: paramValues.duration,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  if (templateId === 'lip-sync') {
    const modelDef = getModelById(lipSyncModels, modelId);
    return processLipSync(apiKey, {
      image_url: inputs.image || '',
      audio_url: inputs.audio || '',
      model: modelId,
      _modelDef: modelDef,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  if (templateId === 'generate-audio') {
    const modelDef = getModelById(audioModels, modelId);
    return generateAudio(apiKey, {
      prompt: inputs.prompt || '',
      model: modelId,
      _modelDef: modelDef,
      onTaskId: (id) => onStatus?.('running', id),
      onProgress: () => {},
    });
  }

  throw new Error(`Unknown node template: ${templateId}`);
}

export async function runWorkflow(apiKey, nodes, edges, store) {
  const sorted = topologicalSort(nodes, edges);
  const nodeResults = {};

  store.setIsRunning(true);

  for (const nodeId of sorted) {
    store.setNodeStatus(nodeId, 'idle');
    store.setNodeResult(nodeId, null);
  }

  for (const nodeId of sorted) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    store.setNodeStatus(nodeId, 'queued');

    try {
      const inputs = resolveInputs(nodeId, node.data, edges, nodeResults);
      store.setNodeStatus(nodeId, 'running');

      const result = await executeNode(apiKey, node, inputs, (status, taskId) => {
        store.setNodeStatus(nodeId, status);
      });

      nodeResults[nodeId] = result;
      store.setNodeResult(nodeId, result);
      store.setNodeStatus(nodeId, 'done');
    } catch (err) {
      store.setNodeStatus(nodeId, 'error');
      store.setNodeResult(nodeId, { error: err.message });
      store.setIsRunning(false);
      throw err;
    }
  }

  store.setIsRunning(false);
  return nodeResults;
}
