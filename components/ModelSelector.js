'use client';

export default function ModelSelector({ models, selected, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-white/30 uppercase tracking-wider">Model</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {models.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`text-left px-4 py-3 rounded-lg border transition-all text-sm ${
              selected === m.id
                ? 'border-[#22d3ee]/40 bg-[#22d3ee]/5 text-white'
                : 'border-white/5 bg-white/[0.02] text-white/60 hover:border-white/10 hover:bg-white/[0.04]'
            }`}
          >
            <div className="font-medium">{m.name}</div>
            <div className="text-[11px] text-white/30 mt-0.5">{m.provider}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
