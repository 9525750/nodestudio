'use client';

import { useState, useCallback } from 'react';
import { processLipSync } from '@/lib/kie';
import { lipSyncModels, getModelById, getDefaultInputValues } from '@/lib/models';
import ModelSelector from '@/components/ModelSelector';
import FileUpload from '@/components/FileUpload';
import GenerationResult from '@/components/GenerationResult';
import StatusIndicator from '@/components/StatusIndicator';

export default function LipSyncStudio({ apiKey }) {
  const [selectedModel, setSelectedModel] = useState(lipSyncModels[0]?.id);
  const [audioUrl, setAudioUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [params, setParams] = useState(() => getDefaultInputValues(lipSyncModels[0]));
  const [status, setStatus] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const modelDef = getModelById(lipSyncModels, selectedModel);
  const isVideoMode = modelDef?.mode === 'video';

  const handleModelChange = useCallback((id) => {
    setSelectedModel(id);
    setParams(getDefaultInputValues(getModelById(lipSyncModels, id)));
    setResult(null);
    setError(null);
  }, []);

  const handleGenerate = async () => {
    if (!audioUrl) { setError('Please upload an audio file'); return; }
    if (isVideoMode && !videoUrl) { setError('Please upload a source video'); return; }
    if (!isVideoMode && !imageUrl) { setError('Please upload a portrait image'); return; }

    setStatus('running');
    setError(null);
    setResult(null);
    setTaskId(null);

    try {
      const res = await processLipSync(apiKey, {
        ...params,
        model: selectedModel,
        audio_url: audioUrl,
        image_url: imageUrl,
        video_url: videoUrl,
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
      <ModelSelector models={lipSyncModels} selected={selectedModel} onChange={handleModelChange} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isVideoMode ? (
          <FileUpload apiKey={apiKey} accept="video/*" label="Source Video" onUpload={setVideoUrl} />
        ) : (
          <FileUpload apiKey={apiKey} accept="image/*" label="Portrait Image" onUpload={setImageUrl} />
        )}
        <FileUpload apiKey={apiKey} accept="audio/*" label="Audio File (≤60s)" onUpload={setAudioUrl} />
      </div>

      {modelDef?.inputs?.resolution && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider">Resolution</label>
          <select
            value={params.resolution || '720p'}
            onChange={e => setParams(p => ({ ...p, resolution: e.target.value }))}
            className="bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 appearance-none"
          >
            {modelDef.inputs.resolution.options.map(opt => (
              <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={status === 'running' || status === 'queued'}
          className="px-6 py-2.5 bg-[#22d3ee] text-black font-medium rounded-md hover:bg-[#e5ff33] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {status === 'running' || status === 'queued' ? 'Processing...' : 'Generate Lip Sync'}
        </button>
        <StatusIndicator status={status} taskId={taskId} />
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">{error}</div>
      )}

      <GenerationResult result={result} type="video" />
    </div>
  );
}
