'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ApiKeyModal from '@/components/ApiKeyModal';
import { getBalance } from '@/lib/kie';

const ImageStudio = dynamic(() => import('@/components/studios/ImageStudio'), { ssr: false });
const VideoStudio = dynamic(() => import('@/components/studios/VideoStudio'), { ssr: false });
const AudioStudio = dynamic(() => import('@/components/studios/AudioStudio'), { ssr: false });
const LipSyncStudio = dynamic(() => import('@/components/studios/LipSyncStudio'), { ssr: false });
const CinemaStudio = dynamic(() => import('@/components/studios/CinemaStudio'), { ssr: false });
const MarketingStudio = dynamic(() => import('@/components/studios/MarketingStudio'), { ssr: false });
const WorkflowStudio = dynamic(() => import('@/components/studios/WorkflowStudio'), { ssr: false });
const DisabledStudio = dynamic(() => import('@/components/studios/DisabledStudio'), { ssr: false });

const TABS = [
  {
    id: 'image', label: 'Image Studio', status: 'active',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  },
  {
    id: 'video', label: 'Video Studio', status: 'active',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  },
  {
    id: 'audio', label: 'Audio Studio', status: 'active',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  {
    id: 'lipsync', label: 'Lip Sync', status: 'active',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  },
  {
    id: 'cinema', label: 'Cinema Studio', status: 'partial',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>,
  },
  {
    id: 'marketing', label: 'Marketing Studio', status: 'partial',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/></svg>,
  },
  {
    id: 'workflow', label: 'Workflows', status: 'active',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/><path d="M12 13v2"/></svg>,
  },
  {
    id: 'agent', label: 'Agents', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>,
  },
  {
    id: 'clipping', label: 'AI Clipping', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.47" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  },
  {
    id: 'motion', label: 'Motion Control', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><path d="M9 11l3 3 3-3"/><path d="M7 21l5-5 5 5"/></svg>,
  },
  {
    id: 'vibe', label: 'Vibe Motion', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  },
  {
    id: 'recast', label: 'Body Swap', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  },
  {
    id: 'layers', label: 'Layers Studio', status: 'disabled',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  },
];

const CATEGORIES = [
  { id: 'images', label: 'Images', tabIds: ['image', 'layers', 'cinema'],
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  },
  { id: 'video', label: 'Video', tabIds: ['video', 'clipping', 'motion', 'vibe', 'lipsync', 'recast', 'marketing'],
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="15" height="16" rx="2"/><path d="M17 9l5-3v12l-5-3"/><path d="M8 9l4 3-4 3z"/></svg>,
  },
  { id: 'audio', label: 'Audio', tabIds: ['audio'],
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  { id: 'agents', label: 'Agents & Automation', tabIds: ['agent', 'workflow'],
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 13v2"/></svg>,
  },
];

const STATUS_DOT = { active: 'bg-green-500', partial: 'bg-yellow-400', disabled: 'bg-white/10' };

function getCategory(tabId) {
  return CATEGORIES.find(c => c.tabIds.includes(tabId));
}

export default function Home() {
  const [tab, setTab] = useState('image');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [balance, setBalance] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState('images');

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('kie_api_key') : null;
    if (stored) {
      setApiKey(stored);
      fetchBalance(stored);
    } else {
      setShowKeyModal(true);
    }
  }, []);

  const fetchBalance = useCallback(async (key) => {
    try {
      const data = await getBalance(key);
      setBalance(data.balance ?? data.credits ?? data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    const iv = setInterval(() => fetchBalance(apiKey), 30000);
    return () => clearInterval(iv);
  }, [apiKey, fetchBalance]);

  useEffect(() => {
    const cat = getCategory(tab);
    if (cat) setExpandedCategory(cat.id);
  }, [tab]);

  const handleSaveKey = (key) => {
    setApiKey(key);
    localStorage.setItem('kie_api_key', key);
    setShowKeyModal(false);
    fetchBalance(key);
  };

  const handleKeyChange = () => {
    localStorage.removeItem('kie_api_key');
    setApiKey('');
    setBalance(null);
    setShowSettings(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebar_collapsed', (!prev).toString());
      return !prev;
    });
  };

  const handleCategoryToggle = (catId) => {
    if (sidebarCollapsed && !mobileOpen) {
      setExpandedCategory(catId);
      setSidebarCollapsed(false);
      return;
    }
    setExpandedCategory(prev => prev === catId ? null : catId);
  };

  if (!mounted) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-spin text-[#22d3ee] text-3xl">&#9676;</div>
    </div>
  );

  if (!apiKey) return <ApiKeyModal onSave={handleSaveKey} onClose={() => {}} />;

  const activeCategory = getCategory(tab);
  const activeTabDef = TABS.find(t => t.id === tab);
  const isCollapsed = sidebarCollapsed && !mobileOpen;

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
      case 'recast': return <DisabledStudio name="Body Swap" reason="Video body swap / style recasting has no Kie.ai equivalent model." />;
      case 'layers': return <DisabledStudio name="Layers Studio" reason="Multi-layer compositing has no Kie.ai equivalent." />;
      default: return null;
    }
  };

  return (
    <div className="h-screen bg-[#030303] flex flex-col overflow-hidden text-white">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-white/[0.05] flex items-center justify-between px-4 bg-[#0a0a0b]/80 backdrop-blur-md z-50 gap-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* Desktop sidebar toggle */}
          <button onClick={toggleSidebar} className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 3v18"/>
              <path d="M14 9l-3 3 3 3"/>
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#22d3ee] rounded-lg flex items-center justify-center shadow-lg shadow-[#22d3ee]/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight hidden sm:block">NodeStudio</span>
          </div>
        </div>

        {/* Active tab breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] text-xs text-white/60">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]"/>
          <span className="font-medium text-white/80">{activeTabDef?.label || 'Studio'}</span>
        </div>

        {/* Right actions */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
            <span className="text-xs font-bold text-white/90">
              ${balance !== null ? Number(balance).toFixed(2) : '---'}
            </span>
          </div>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed top-14 bottom-0 left-0 md:static md:h-full z-30 bg-[#0a0a0b]/95 backdrop-blur-md border-r border-white/[0.06] flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 select-none
          ${mobileOpen ? 'translate-x-0 w-60 z-50' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-16' : 'md:w-52'}
        `}>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 scrollbar-none">
            <div className="space-y-1">
              {CATEGORIES.map(cat => {
                const isCatActive = activeCategory?.id === cat.id;
                const isCatOpen = !isCollapsed && expandedCategory === cat.id;

                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => handleCategoryToggle(cat.id)}
                      title={isCollapsed ? cat.label : undefined}
                      className={`
                        group relative flex items-center rounded-xl transition-all duration-150 font-semibold
                        ${isCollapsed ? 'h-11 w-11 justify-center mx-auto' : 'px-3 py-2.5 w-full gap-3 text-left'}
                        ${isCatActive
                          ? 'bg-gradient-to-r from-[#22d3ee]/15 to-purple-500/10 text-[#22d3ee] border border-[#22d3ee]/20 shadow-[0_0_15px_rgba(34,211,238,0.08)]'
                          : isCatOpen
                            ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                        }
                      `}
                    >
                      {isCatActive && <span className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-[#22d3ee] to-[#a855f7] rounded-r-full shadow-[0_0_8px_rgba(34,211,238,0.6)]" />}
                      <span className={`flex-shrink-0 transition-colors ${isCatActive ? 'text-[#22d3ee]' : 'text-white/55 group-hover:text-white'}`}>
                        {cat.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 min-w-0 text-[12px] leading-4 tracking-tight">{cat.label}</span>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 transition-transform duration-200 ${isCatOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
                        </>
                      )}
                    </button>

                    {!isCollapsed && isCatOpen && (
                      <div className="mt-1 ml-2 pl-2 border-l border-white/[0.08] space-y-1">
                        {cat.tabIds.map(tabId => {
                          const t = TABS.find(x => x.id === tabId);
                          if (!t) return null;
                          const isActive = tab === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => { setTab(t.id); setMobileOpen(false); }}
                              className={`
                                group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-all duration-150 w-full text-left
                                ${isActive
                                  ? 'bg-[#22d3ee]/12 text-[#22d3ee] border border-[#22d3ee]/20'
                                  : t.status === 'disabled'
                                    ? 'text-white/25 hover:text-white/40 hover:bg-white/[0.02] border border-transparent'
                                    : 'text-white/55 hover:text-white hover:bg-white/[0.04] border border-transparent'
                                }
                              `}
                            >
                              {isActive && <span className="absolute -left-[11px] top-2 bottom-2 w-0.5 rounded-full bg-[#22d3ee] shadow-[0_0_7px_rgba(34,211,238,0.7)]" />}
                              <span className={`flex-shrink-0 ${isActive ? 'text-[#22d3ee]' : 'text-white/45 group-hover:text-white/80'}`}>
                                {t.icon}
                              </span>
                              <span className="truncate">{t.label}</span>
                              {t.status !== 'active' && (
                                <span className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Studio content */}
        <div className="flex-1 min-h-0 h-full relative overflow-auto bg-[#030303]">
          <div className="h-full w-full p-6">
            {renderStudio()}
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-2">Settings</h2>
            <p className="text-white/40 text-[13px] mb-8">Manage your Kie.ai API key and account</p>
            <div className="space-y-4 mb-8">
              <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <label className="block text-xs font-bold text-white/30 mb-2">Active API Key</label>
                <div className="text-[13px] font-mono text-white/80">{apiKey.slice(0, 8)}{'*'.repeat(16)}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleKeyChange} className="flex-1 h-10 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all">Change Key</button>
              <button onClick={() => setShowSettings(false)} className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5">Close</button>
            </div>
          </div>
        </div>
      )}

      {showKeyModal && <ApiKeyModal onSave={handleSaveKey} onClose={() => {}} />}
    </div>
  );
}
