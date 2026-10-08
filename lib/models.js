export const t2iModels = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    kieModel: 'nano-banana-2',
    provider: 'Google',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
      resolution: { type: 'select', options: ['1K', '2K'], default: '1K' },
    },
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    kieModel: 'nano-banana-pro',
    provider: 'Google',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
    },
  },
  {
    id: 'seedream-5-pro-t2i',
    name: 'Seedream 5.0 Pro',
    kieModel: 'seedream/5-pro-text-to-image',
    provider: 'ByteDance',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3'], default: '1:1' },
    },
  },
  {
    id: 'seedream-5-flash-t2i',
    name: 'Seedream 5.0 Flash',
    kieModel: 'seedream/5-flash-text-to-image',
    provider: 'ByteDance',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
    },
  },
  {
    id: 'gpt-image-2-t2i',
    name: 'GPT Image 2',
    kieModel: 'gpt-image-2-text-to-image',
    provider: 'OpenAI',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
    },
  },
  {
    id: 'flux-kontext',
    name: 'Flux Kontext Pro',
    kieModel: 'flux1-kontext',
    provider: 'Black Forest Labs',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'],
    kieExtraInput: { model: 'flux-kontext-pro' },
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'], default: '1:1' },
    },
  },
  {
    id: 'qwen-image-2-1',
    name: 'Qwen Image 2.1',
    kieModel: 'qwen/text-to-image',
    provider: 'Alibaba',
    aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
    },
  },
];

export const i2iModels = [
  {
    id: 'gpt-image-2-i2i',
    name: 'GPT Image 2 (Edit)',
    kieModel: 'gpt-image-2-image-to-image',
    provider: 'OpenAI',
    kieImageField: 'input_image',
    inputs: {
      prompt: { type: 'string', required: true },
      input_image: { type: 'image', required: true },
    },
  },
  {
    id: 'flux-kontext-edit',
    name: 'Flux Kontext (Edit)',
    kieModel: 'flux1-kontext',
    provider: 'Black Forest Labs',
    kieImageField: 'input_image',
    kieExtraInput: { model: 'flux-kontext-pro' },
    inputs: {
      prompt: { type: 'string', required: true },
      input_image: { type: 'image', required: true },
    },
  },
  {
    id: 'qwen-image-i2i',
    name: 'Qwen Image (Edit)',
    kieModel: 'qwen/image-to-image',
    provider: 'Alibaba',
    kieImageField: 'input_image',
    inputs: {
      prompt: { type: 'string', required: true },
      input_image: { type: 'image', required: true },
    },
  },
  {
    id: 'nano-banana-edit',
    name: 'Nano Banana (Edit)',
    kieModel: 'nano-banana-2',
    provider: 'Google',
    kieImageField: 'input_image',
    kieMultiImage: 'image_urls',
    inputs: {
      prompt: { type: 'string', required: true },
      input_image: { type: 'image', required: true },
    },
  },
];

export const t2vModels = [
  {
    id: 'kling-2-6-t2v',
    name: 'Kling 2.6',
    kieModel: 'kling-2.6/text-to-video',
    provider: 'Kuaishou',
    inputs: {
      prompt: { type: 'string', required: true, maxLength: 2500 },
      sound: { type: 'boolean', default: false, label: 'Generate Audio' },
      aspect_ratio: { type: 'select', options: ['1:1', '16:9', '9:16'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
    },
  },
  {
    id: 'veo-3-1-t2v',
    name: 'Veo 3.1',
    kieModel: 'veo-3-1',
    provider: 'Google',
    kieExtraInput: { model: 'veo3_fast' },
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16'], default: '16:9' },
      duration: { type: 'select', options: ['4', '6', '8'], default: '8', label: 'Duration (s)' },
      resolution: { type: 'select', options: ['720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'veo-3-1-quality',
    name: 'Veo 3.1 Quality',
    kieModel: 'veo-3-1',
    provider: 'Google',
    kieExtraInput: { model: 'veo3' },
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16'], default: '16:9' },
      duration: { type: 'select', options: ['4', '6', '8'], default: '8', label: 'Duration (s)' },
    },
  },
  {
    id: 'runway-t2v',
    name: 'Runway',
    kieModel: 'runway',
    provider: 'Runway',
    inputs: {
      prompt: { type: 'string', required: true, maxLength: 1800 },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
      quality: { type: 'select', options: ['720p', '1080p'], default: '720p' },
      aspect_ratio: { type: 'select', options: ['16:9', '4:3', '1:1', '3:4', '9:16'], default: '16:9' },
    },
  },
  {
    id: 'seedance-2-5-t2v',
    name: 'Seedance 2.5',
    kieModel: 'seedance-2.5/text-to-video',
    provider: 'ByteDance',
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
      resolution: { type: 'select', options: ['480p', '720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'seedance-2-0-t2v',
    name: 'Seedance 2.0',
    kieModel: 'seedance-2.0/text-to-video',
    provider: 'ByteDance',
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
      resolution: { type: 'select', options: ['480p', '720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'wan-3-0-t2v',
    name: 'Wan 3.0',
    kieModel: 'wan3.0/text-to-video',
    provider: 'Alibaba',
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5', label: 'Duration (s)' },
    },
  },
  {
    id: 'gemini-omni-flash-t2v',
    name: 'Gemini Omni Flash',
    kieModel: 'google/gemini-omni-flash-1-1',
    provider: 'Google',
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16'], default: '16:9' },
    },
  },
  {
    id: 'grok-imagine-1-5-t2v',
    name: 'Grok Imagine 1.5',
    kieModel: 'grok-imagine/text-to-video',
    provider: 'xAI',
    inputs: {
      prompt: { type: 'string', required: true },
      aspect_ratio: { type: 'select', options: ['9:16', '16:9', '2:3', '3:2', '1:1'], default: '16:9' },
      duration: { type: 'select', options: ['6', '12', '18', '24', '30'], default: '6', label: 'Duration (s)' },
      resolution: { type: 'select', options: ['480p', '720p'], default: '480p' },
    },
  },
];

export const i2vModels = [
  {
    id: 'kling-2-6-i2v',
    name: 'Kling 2.6 (I2V)',
    kieModel: 'kling-2.6/image-to-video',
    provider: 'Kuaishou',
    kieImageField: 'image_url',
    inputs: {
      prompt: { type: 'string' },
      image_url: { type: 'image', required: true },
      sound: { type: 'boolean', default: false },
      aspect_ratio: { type: 'select', options: ['1:1', '16:9', '9:16'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5' },
    },
  },
  {
    id: 'veo-3-1-i2v',
    name: 'Veo 3.1 (I2V)',
    kieModel: 'veo-3-1',
    provider: 'Google',
    kieImageListField: 'image_urls',
    kieExtraInput: { model: 'veo3_fast', generation_type: 'FIRST_AND_LAST_FRAMES_2_VIDEO' },
    inputs: {
      prompt: { type: 'string', required: true },
      image_urls: { type: 'image', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16'], default: '16:9' },
      duration: { type: 'select', options: ['4', '6', '8'], default: '8' },
    },
  },
  {
    id: 'runway-i2v',
    name: 'Runway (I2V)',
    kieModel: 'runway',
    provider: 'Runway',
    kieImageField: 'image_url',
    inputs: {
      prompt: { type: 'string', required: true },
      image_url: { type: 'image', required: true },
      duration: { type: 'select', options: ['5', '10'], default: '5' },
      quality: { type: 'select', options: ['720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'seedance-2-5-i2v',
    name: 'Seedance 2.5 (I2V)',
    kieModel: 'seedance-2.5/image-to-video',
    provider: 'ByteDance',
    kieImageField: 'image_url',
    inputs: {
      prompt: { type: 'string' },
      image_url: { type: 'image', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5' },
      resolution: { type: 'select', options: ['480p', '720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'seedance-2-0-i2v',
    name: 'Seedance 2.0 (I2V)',
    kieModel: 'seedance-2.0/image-to-video',
    provider: 'ByteDance',
    kieImageField: 'image_url',
    inputs: {
      prompt: { type: 'string' },
      image_url: { type: 'image', required: true },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], default: '16:9' },
      duration: { type: 'select', options: ['5', '10'], default: '5' },
      resolution: { type: 'select', options: ['480p', '720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'grok-imagine-1-5-i2v',
    name: 'Grok Imagine 1.5 (I2V)',
    kieModel: 'grok-imagine/image-to-video',
    provider: 'xAI',
    kieImageField: 'image_url',
    inputs: {
      prompt: { type: 'string' },
      image_url: { type: 'image', required: true },
      aspect_ratio: { type: 'select', options: ['9:16', '16:9', '1:1'], default: '16:9' },
      duration: { type: 'select', options: ['6', '12', '18'], default: '6' },
      resolution: { type: 'select', options: ['480p', '720p'], default: '480p' },
    },
  },
];

export const lipSyncModels = [
  {
    id: 'omnihuman-1-5',
    name: 'OmniHuman 1.5',
    kieModel: 'omnihuman-1.5/lip-sync',
    provider: 'ByteDance',
    mode: 'image',
    inputs: {
      image_url: { type: 'image', required: true, label: 'Portrait Image' },
      audio_url: { type: 'audio', required: true, label: 'Audio File' },
      resolution: { type: 'select', options: ['720p', '1080p'], default: '720p' },
    },
  },
  {
    id: 'volcengine-lipsync',
    name: 'Volcengine Lip Sync',
    kieModel: 'volcengine/video-lip-sync',
    provider: 'ByteDance',
    mode: 'video',
    inputs: {
      video_url: { type: 'video', required: true, label: 'Source Video' },
      audio_url: { type: 'audio', required: true, label: 'Audio File' },
    },
  },
];

export const audioModels = [
  {
    id: 'suno-v5-5',
    name: 'Suno V5.5',
    kieModel: 'suno/v5.5',
    provider: 'Suno',
    inputs: {
      prompt: { type: 'string', required: true, label: 'Music Description' },
      lyrics: { type: 'textarea', label: 'Lyrics (optional)' },
      style: { type: 'string', label: 'Style (optional)' },
      title: { type: 'string', label: 'Title (optional)' },
    },
  },
  {
    id: 'elevenlabs-tts',
    name: 'ElevenLabs TTS',
    kieModel: 'elevenlabs/text-to-speech',
    provider: 'ElevenLabs',
    inputs: {
      prompt: { type: 'string', required: true, label: 'Text to speak' },
    },
  },
  {
    id: 'gemini-flash-tts',
    name: 'Gemini Flash TTS',
    kieModel: 'gemini-3.8-flash-tts',
    provider: 'Google',
    inputs: {
      prompt: { type: 'string', required: true, label: 'Text to speak' },
    },
  },
];

export const STUDIO_STATUS = {
  IMAGE: 'active',
  VIDEO: 'active',
  AUDIO: 'active',
  LIPSYNC: 'active',
  CINEMA: 'partial',
  MARKETING: 'partial',
  WORKFLOW: 'active',
  AGENT: 'disabled',
  CLIPPING: 'disabled',
  MOTION_CONTROL: 'disabled',
  VIBE_MOTION: 'disabled',
  RECAST: 'disabled',
  LAYERS: 'disabled',
  DESIGN_AGENT: 'disabled',
  AI_INFLUENCER: 'disabled',
  APPS: 'disabled',
  MCP_CLI: 'disabled',
};

export function getModelById(models, id) {
  return models.find(m => m.id === id) || null;
}

export function getDefaultInputValues(modelDef) {
  if (!modelDef?.inputs) return {};
  const values = {};
  for (const [key, def] of Object.entries(modelDef.inputs)) {
    if (def.default !== undefined) values[key] = def.default;
  }
  return values;
}
