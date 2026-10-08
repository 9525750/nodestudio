'use client';

import { useState } from 'react';
import { generateVideo } from '@/lib/kie';
import FileUpload from '@/components/FileUpload';
import GenerationResult from '@/components/GenerationResult';
import StatusIndicator from '@/components/StatusIndicator';

export default function MarketingStudio({ apiKey }) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('5');
  const [imageUrl, setImageUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus('running');
    setError(null);
    setResult(null);

    try {
      const res = await generateVideo(apiKey, {
        prompt,
        model: 'seedance-marketing',
        _modelDef: {
          kieModel: 'seedance-2.5/text-to-video',
          kieExtraInput: {},
        },
        aspect_ratio: aspectRatio,
        duration,
        image_url: imageUrl,
        images_list: imageUrl ? [imageUrl] : undefined,
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
      <p className="text-white/30 text-sm">Generate marketing videos from product descriptions and reference images.</p>

      <FileUpload apiKey={apiKey} accept="image/*" label="Product Image (optional)" onUpload={setImageUrl} />

      <div className="space-y-2">
        <label className="block text-xs font-bold text-white/30 uppercase tracking-wider">Ad Description</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe your marketing video: product, style, mood, call to action..."
          rows={4}
          className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase">Aspect Ratio</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30">
            {['16:9', '9:16', '1:1', '4:3'].map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase">Duration</label>
          <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white appearance-none focus:ring-1 focus:ring-[#22d3ee]/30">
            {['5', '10'].map(o => <option key={o} value={o} className="bg-[#0a0a0a]">{o}s</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleGenerate} disabled={status === 'running' || status === 'queued'} className="px-6 py-2.5 bg-[#22d3ee] text-black font-medium rounded-md hover:bg-[#e5ff33] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {status === 'running' || status === 'queued' ? 'Generating...' : 'Generate Ad'}
        </button>
        <StatusIndicator status={status} taskId={taskId} />
      </div>

      {error && <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">{error}</div>}
      <GenerationResult result={result} type="video" />
    </div>
  );
}
