'use client';

import { useState, useRef } from 'react';
import { uploadFileToKie } from '@/lib/kie';

export default function FileUpload({ apiKey, accept, label, onUpload, className = '' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreview(URL.createObjectURL(file));
    }

    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadFileToKie(apiKey, file, setProgress);
      onUpload(url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1.5">
        {label || 'Upload File'}
      </label>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="relative cursor-pointer border-2 border-dashed border-white/10 hover:border-[#22d3ee]/30 rounded-lg p-4 text-center transition-all min-h-[100px] flex flex-col items-center justify-center"
      >
        {uploading ? (
          <div className="space-y-2">
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div className="bg-[#22d3ee] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-white/40">{progress}%</span>
          </div>
        ) : preview ? (
          <div className="relative">
            {accept?.includes('image') ? (
              <img src={preview} alt="Preview" className="max-h-24 rounded object-contain" />
            ) : accept?.includes('video') ? (
              <video src={preview} className="max-h-24 rounded" />
            ) : (
              <span className="text-xs text-[#22d3ee]">File uploaded</span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreview(null); onUpload(null); }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20 mb-2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs text-white/30">Drop or click to upload</span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
