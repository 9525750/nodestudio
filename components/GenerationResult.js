'use client';

export default function GenerationResult({ result, type = 'image' }) {
  if (!result) return null;

  const url = result.url || result.urls?.[0];
  if (!url) return null;

  const handleDownload = async () => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `nodestudio-${type}-${Date.now()}.${type === 'image' ? 'png' : type === 'audio' ? 'mp3' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="mt-6 animate-fade-in">
      <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40">
        {type === 'image' && (
          <img src={url} alt="Generated" className="w-full max-h-[600px] object-contain" />
        )}
        {type === 'video' && (
          <video src={url} controls className="w-full max-h-[600px]" />
        )}
        {type === 'audio' && (
          <div className="p-6">
            <audio src={url} controls className="w-full" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleDownload}
          className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
        >
          Download
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(url); }}
          className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
        >
          Copy URL
        </button>
        {result.creditsConsumed !== undefined && (
          <span className="text-xs text-white/30 ml-auto">
            {result.creditsConsumed} credits • {result.costTime}s
          </span>
        )}
      </div>
    </div>
  );
}
