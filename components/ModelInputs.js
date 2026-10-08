'use client';

export default function ModelInputs({ modelDef, values, onChange }) {
  if (!modelDef?.inputs) return null;

  const entries = Object.entries(modelDef.inputs).filter(
    ([key, def]) => def.type !== 'image' && def.type !== 'video' && def.type !== 'audio' && key !== 'prompt'
  );

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {entries.map(([key, def]) => (
        <div key={key} className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider">
            {def.label || def.title || key}
          </label>
          {def.type === 'select' && (
            <select
              value={values[key] ?? def.default ?? ''}
              onChange={e => onChange(key, e.target.value)}
              className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 appearance-none"
            >
              {def.options.map(opt => (
                <option key={opt} value={opt} className="bg-[#0a0a0a]">{opt}</option>
              ))}
            </select>
          )}
          {def.type === 'boolean' && (
            <button
              type="button"
              onClick={() => onChange(key, !values[key])}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all w-full ${
                values[key]
                  ? 'bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee]'
                  : 'bg-white/5 border border-white/[0.06] text-white/40'
              }`}
            >
              {values[key] ? 'On' : 'Off'}
            </button>
          )}
          {(def.type === 'string' && key !== 'prompt') && (
            <input
              type="text"
              value={values[key] ?? def.default ?? ''}
              onChange={e => onChange(key, e.target.value)}
              placeholder={def.label || key}
              className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30"
            />
          )}
          {def.type === 'textarea' && (
            <textarea
              value={values[key] ?? ''}
              onChange={e => onChange(key, e.target.value)}
              placeholder={def.label || key}
              rows={3}
              className="w-full bg-white/5 border border-white/[0.06] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/30 resize-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}
