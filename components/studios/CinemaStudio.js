'use client';

import { useState } from 'react';
import { generateVideo } from '@/lib/kie';
import FileUpload from '@/components/FileUpload';
import GenerationResult from '@/components/GenerationResult';
import StatusIndicator from '@/components/StatusIndicator';

const CINEMA_MODELS = [
  { id: 'seedance-2-5-cinema', name: 'Seedance 2.5', kieModel: 'seedance-2.5/text-to-video', provider: 'ByteDance' },
  { id: 'veo-3-1-cinema', name: 'Veo 3.1 Quality', kieModel: 'veo-3-1', provider: 'Google', kieExtraInput: { model: 'veo3' } },
  { id: 'runway-cinema', name: 'Runway', kieModel: 'runway', provider: 'Runway' },
];

export default function CinemaStudio({ apiKey }) {
  const [model, setModel] = useState(CINEMA_MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('21:9');
  const [duration, setDuration] = useState('10');
  const [resolution, setResolution] = useState('1080p');
  const [status, setStatus] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedModel = CINEMA_MODELS.find(m => m.id === model);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus('running');
    setError(null);
    setResult(null);

    try {
      const res = await generateVideo(apiKey, {
        prompt,
        model: model,
        _modelDef: selectedModel,
        aspect_ratio: aspectRatio,
        duration,
        resolution,
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
      <p className="text-white/30 text-sm">Cinematic video generation with widescreen aspect ratios and high-quality models.</p>

      <div className="grid grid-cols-3 gap-2">
        {CINEMA_MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            className={`px-4 py-3 rounded-lg border text-sm text-left transition-all ${
              model === m.id ? 'border-[#22d3ee]/40 bg-[#22d3ee]/5 text-white' : 'border-white/5 bg-white/[0.02] text-white/60 hover:border-white/10'
            }`}
          >
            <div className="font-medium">{m.name}</div>
            <div className="text-[11px] text-white/30">{m.provider}</div>
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe your cinematic scene..."
        rows={4}
        className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 resize-none"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase">Aspect Ratio</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30">
            {['21:9', '16:9', '1:1', '9:16'].map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase">Duration</label>
          <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30">
            {['5', '8', '10'].map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}s</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase">Resolution</label>
          <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30">
            {['720p', '1080p'].map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleGenerate} disabled={status === 'running' || status === 'queued'} className="px-6 py-2.5 bg-[#22d3ee] text-black font-medium rounded-md hover:bg-[#e5ff33] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {status === 'running' || status === 'queued' ? 'Generating...' : 'Generate Scene'}
        </button>
        <StatusIndicator status={status} taskId={taskId} />
      </div>

      {error && <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">{error}</div>}
      <GenerationResult result={result} type="video" />
    </div>
  );
}
