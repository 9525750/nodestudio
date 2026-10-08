'use client';

import { useState, useCallback } from 'react';
import { generateAudio } from '@/lib/kie';
import { audioModels, getModelById, getDefaultInputValues } from '@/lib/models';
import ModelSelector from '@/components/ModelSelector';
import ModelInputs from '@/components/ModelInputs';
import GenerationResult from '@/components/GenerationResult';
import StatusIndicator from '@/components/StatusIndicator';

export default function AudioStudio({ apiKey }) {
  const [selectedModel, setSelectedModel] = useState(audioModels[0]?.id);
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState(() => getDefaultInputValues(audioModels[0]));
  const [status, setStatus] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const modelDef = getModelById(audioModels, selectedModel);

  const handleModelChange = useCallback((id) => {
    setSelectedModel(id);
    setParams(getDefaultInputValues(getModelById(audioModels, id)));
    setResult(null);
    setError(null);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus('running');
    setError(null);
    setResult(null);
    setTaskId(null);

    try {
      const res = await generateAudio(apiKey, {
        ...params,
        prompt,
        model: selectedModel,
        _modelDef: modelDef,
        onTaskId: (id) => setTaskId(id),
        onProgress: (p) => {
          if (p.state === 'queuing' || p.state === 'waiting') setStatus('queued');
          else setStatus('running');
        },
      });
      setResult(res);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ModelSelector models={audioModels} selected={selectedModel} onChange={handleModelChange} />

      <div className="space-y-2">
        <label className="block text-xs font-bold text-white/30 uppercase tracking-wider">
          {modelDef?.inputs?.prompt?.label || 'Prompt'}
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the music or audio you want to generate..."
          rows={3}
          className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 resize-none"
        />
      </div>

      <ModelInputs modelDef={modelDef} values={params} onChange={(k, v) => setParams(p => ({ ...p, [k]: v }))} />

      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={status === 'running' || status === 'queued'}
          className="px-6 py-2.5 bg-[#22d3ee] text-black font-medium rounded-md hover:bg-[#e5ff33] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {status === 'running' || status === 'queued' ? 'Generating...' : 'Generate'}
        </button>
        <StatusIndicator status={status} taskId={taskId} />
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">{error}</div>
      )}

      <GenerationResult result={result} type="audio" />
    </div>
  );
}
