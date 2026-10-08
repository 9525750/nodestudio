'use client';

export default function DisabledStudio({ name, reason }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-24">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
        <span className="text-2xl text-white/10">⊘</span>
      </div>
      <h2 className="text-lg font-medium text-white/40 mb-2">{name}</h2>
      <p className="text-sm text-white/20 max-w-md mx-auto">
        {reason || 'This studio has no equivalent model on Kie.ai and is currently disabled.'}
      </p>
      <div className="mt-6 inline-block px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.04] text-[10px] text-white/15 uppercase tracking-wider">
        No Kie.ai analog
      </div>
    </div>
  );
}
