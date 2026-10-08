'use client';

import { useState, useCallback } from 'react';
import { generateImage, generateI2I } from '@/lib/kie';
import { t2iModels, i2iModels, getModelById, getDefaultInputValues } from '@/lib/models';
import ModelSelector from '@/components/ModelSelector';
import ModelInputs from '@/components/ModelInputs';
import FileUpload from '@/components/FileUpload';
import GenerationResult from '@/components/GenerationResult';
import StatusIndicator from '@/components/StatusIndicator';

export default function ImageStudio({ apiKey }) {
  const [mode, setMode] = useState('t2i');
  const models = mode === 't2i' ? t2iModels : i2iModels;
  const [selectedModel, setSelectedModel] = useState(models[0]?.id);
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState(() => getDefaultInputValues(models[0]));
  const [imageUrl, setImageUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const modelDef = getModelById(models, selectedModel);

  const handleModelChange = useCallback((id) => {
    setSelectedModel(id);
    const m = getModelById(models, id);
    setParams(getDefaultInputValues(m));
    setResult(null);
    setError(null);
  }, [models]);

  const handleModeChange = (m) => {
    setMode(m);
    const newModels = m === 't2i' ? t2iModels : i2iModels;
    setSelectedModel(newModels[0]?.id);
    setParams(getDefaultInputValues(newModels[0]));
    setResult(null);
    setImageUrl(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && mode === 't2i') return;
    if (mode === 'i2i' && !imageUrl) { setError('Please upload a reference image'); return; }

    setStatus('running');
    setError(null);
    setResult(null);
    setTaskId(null);

    try {
      const fn = mode === 't2i' ? generateImage : generateI2I;
      const res = await fn(apiKey, {
        ...params,
        prompt,
        model: selectedModel,
        image_url: imageUrl,
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
      <div className="flex gap-2 mb-4">
        {['t2i', 'i2i'].map(m => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === m ? 'bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30' : 'bg-white/5 text-white/40 border border-white/5'
            }`}
          >
            {m === 't2i' ? 'Text → Image' : 'Image → Image'}
          </button>
        ))}
      </div>

      <ModelSelector models={models} selected={selectedModel} onChange={handleModelChange} />

      {mode === 'i2i' && (
        <FileUpload apiKey={apiKey} accept="image/*" label="Reference Image" onUpload={setImageUrl} />
      )}

      <div className="space-y-2">
        <label className="block text-xs font-bold text-white/30 uppercase tracking-wider">Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe what you want to generate..."
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
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
          {error}
        </div>
      )}

      <GenerationResult result={result} type="image" />
    </div>
  );
}
