'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ApiKeyModal from '@/components/ApiKeyModal';

const ImageStudio = dynamic(() => import('@/components/studios/ImageStudio'), { ssr: false });
const VideoStudio = dynamic(() => import('@/components/studios/VideoStudio'), { ssr: false });
const AudioStudio = dynamic(() => import('@/components/studios/AudioStudio'), { ssr: false });
const LipSyncStudio = dynamic(() => import('@/components/studios/LipSyncStudio'), { ssr: false });
const CinemaStudio = dynamic(() => import('@/components/studios/CinemaStudio'), { ssr: false });
const MarketingStudio = dynamic(() => import('@/components/studios/MarketingStudio'), { ssr: false });
const WorkflowStudio = dynamic(() => import('@/components/studios/WorkflowStudio'), { ssr: false });
const DisabledStudio = dynamic(() => import('@/components/studios/DisabledStudio'), { ssr: false });

const TABS = [
  { id: 'image', label: 'Image', status: 'active' },
  { id: 'video', label: 'Video', status: 'active' },
  { id: 'audio', label: 'Audio', status: 'active' },
  { id: 'lipsync', label: 'Lip Sync', status: 'active' },
  { id: 'cinema', label: 'Cinema', status: 'partial' },
  { id: 'marketing', label: 'Marketing', status: 'partial' },
  { id: 'workflow', label: 'Workflow', status: 'active' },
  { id: 'agent', label: 'Agent', status: 'disabled' },
  { id: 'clipping', label: 'Clipping', status: 'disabled' },
  { id: 'motion', label: 'Motion Ctrl', status: 'disabled' },
  { id: 'vibe', label: 'Vibe Motion', status: 'disabled' },
  { id: 'recast', label: 'Recast', status: 'disabled' },
  { id: 'layers', label: 'Layers', status: 'disabled' },
];

const STATUS_DOT = {
  active: 'bg-[#4ade80]',
  partial: 'bg-[#e5ff33]',
  disabled: 'bg-white/10',
};

export default function Home() {
  const [tab, setTab] = useState('image');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('kie_api_key') : null;
    if (stored) setApiKey(stored);
    else setShowKeyModal(true);
  }, []);

  const handleSaveKey = (key) => {
    setApiKey(key);
    localStorage.setItem('kie_api_key', key);
    setShowKeyModal(false);
  };

  const renderStudio = () => {
    switch (tab) {
      case 'image': return <ImageStudio apiKey={apiKey} />;
      case 'video': return <VideoStudio apiKey={apiKey} />;
      case 'audio': return <AudioStudio apiKey={apiKey} />;
      case 'lipsync': return <LipSyncStudio apiKey={apiKey} />;
      case 'cinema': return <CinemaStudio apiKey={apiKey} />;
      case 'marketing': return <MarketingStudio apiKey={apiKey} />;
      case 'workflow': return <WorkflowStudio apiKey={apiKey} />;
      case 'agent': return <DisabledStudio name="Agent Studio" reason="AI agents require LLM orchestration not available through Kie.ai's generation API." />;
      case 'clipping': return <DisabledStudio name="Clipping Studio" reason="Video clipping and segmentation has no Kie.ai equivalent model." />;
      case 'motion': return <DisabledStudio name="Motion Control" reason="Camera motion control has no standalone Kie.ai endpoint." />;
      case 'vibe': return <DisabledStudio name="Vibe Motion" reason="Vibe-based motion transfer has no Kie.ai equivalent." />;
      case 'recast': return <DisabledStudio name="Recast Studio" reason="Video style recasting has no Kie.ai equivalent model." />;
      case 'layers': return <DisabledStudio name="Layers Studio" reason="Multi-layer compositing has no Kie.ai equivalent." />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {showKeyModal && <ApiKeyModal onSave={handleSaveKey} onClose={() => showKeyModal && apiKey && setShowKeyModal(false)} />}

      <header className="border-b border-white/[0.04] bg-[#030303]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-bold tracking-wide">
                <span className="text-[#22d3ee]">Node</span>
                <span className="text-white/80">Studio</span>
              </h1>
              <span className="text-[9px] text-white/15 border border-white/[0.04] rounded px-1.5 py-0.5 uppercase tracking-wider">Kie.ai</span>
            </div>

            <button
              onClick={() => setShowKeyModal(true)}
              className="text-[11px] text-white/25 hover:text-white/50 transition-colors px-2 py-1 rounded border border-white/[0.04] hover:border-white/10"
            >
              {apiKey ? 'API Key ✓' : 'Set API Key'}
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-white/[0.03] bg-[#030303]/60 backdrop-blur-md sticky top-14 z-40 overflow-x-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex gap-0.5 py-1.5 min-w-max">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => t.status !== 'disabled' ? setTab(t.id) : setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  tab === t.id
                    ? 'bg-white/[0.06] text-white'
                    : t.status === 'disabled'
                      ? 'text-white/15 hover:text-white/25 hover:bg-white/[0.02]'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white/90">
            {TABS.find(t => t.id === tab)?.label} Studio
          </h2>
        </div>
        {renderStudio()}
      </main>
    </div>
  );
}
