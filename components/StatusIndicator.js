'use client';

import { useState, useEffect } from 'react';

export default function StatusIndicator({ status, taskId }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'running' && status !== 'queued') {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'idle') return null;

  const colors = {
    queued: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    running: 'text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/5',
    done: 'text-green-400 border-green-400/30 bg-green-400/5',
    error: 'text-red-400 border-red-400/30 bg-red-400/5',
  };

  const labels = {
    queued: 'Queued',
    running: 'Generating',
    done: 'Complete',
    error: 'Error',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium ${colors[status] || ''}`}>
      {(status === 'running' || status === 'queued') && (
        <svg className="animate-spin-slow w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <span>{labels[status] || status}</span>
      {(status === 'running' || status === 'queued') && (
        <span className="text-white/30">{elapsed}s</span>
      )}
      {taskId && <span className="text-white/20 text-[10px] ml-1">{taskId.slice(0, 20)}...</span>}
    </div>
  );
}
