const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const KIE_UPLOAD_BASE = 'https://kieai.redpandaai.co/api';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 600;

function getApiKey() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kie_api_key');
}

function authHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function isKieError(data) {
  return data && data.code && data.code !== 200;
}

function formatKieError(data, taskId) {
  const msg = data.msg || data.message || 'Unknown error';
  const code = data.code || data.failCode;
  let userMsg = `Kie.ai error (${code}): ${msg}`;
  if (taskId) userMsg += ` [taskId: ${taskId}]`;
  if (code === 401) userMsg = 'Invalid API key. Please check your Kie.ai API key.';
  if (code === 402) userMsg = 'Insufficient credits. Please top up your Kie.ai account.';
  if (code === 429) userMsg = 'Rate limit exceeded. Please wait a moment and try again.';
  if (msg.includes('internal error')) {
    userMsg = `Kie.ai internal error — this model may be temporarily unstable. ${taskId ? `[taskId: ${taskId}]` : ''}`;
  }
  if (msg.includes('no_available_account') || msg.includes('no available account')) {
    userMsg = `Model unavailable on your Kie.ai account. ${taskId ? `[taskId: ${taskId}]` : ''}`;
  }
  return userMsg;
}

export async function createTask(apiKey, model, input, callBackUrl) {
  const body = { model, input };
  if (callBackUrl) body.callBackUrl = callBackUrl;

  const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (isKieError(data)) {
    throw new Error(formatKieError(data));
  }

  const taskId = data.data?.taskId;
  if (!taskId) {
    throw new Error('No taskId returned from Kie.ai. Response: ' + JSON.stringify(data).slice(0, 200));
  }

  return taskId;
}

export async function getTaskStatus(apiKey, taskId) {
  const url = `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  const data = await response.json();

  if (isKieError(data) && data.code !== 200) {
    throw new Error(formatKieError(data, taskId));
  }

  return data.data || data;
}

function extractResultUrls(taskData) {
  if (!taskData.resultJson) return [];
  try {
    const result = typeof taskData.resultJson === 'string'
      ? JSON.parse(taskData.resultJson)
      : taskData.resultJson;
    if (result.resultUrls && Array.isArray(result.resultUrls)) {
      return result.resultUrls;
    }
    if (result.resultImageUrl) return [result.resultImageUrl];
    if (result.resultObject?.mask_urls) return result.resultObject.mask_urls;
    if (result.data?.result_urls) return result.data.result_urls;
    if (result.data?.origin_urls) return result.data.origin_urls;
    return [];
  } catch {
    return [];
  }
}

export async function pollUntilDone(apiKey, taskId, onProgress) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const taskData = await getTaskStatus(apiKey, taskId);
    const state = (taskData.state || '').toLowerCase();

    if (onProgress) {
      onProgress({ state, attempt, taskId });
    }

    if (state === 'success') {
      const urls = extractResultUrls(taskData);
      return {
        taskId,
        state: 'success',
        urls,
        url: urls[0] || null,
        raw: taskData,
        creditsConsumed: taskData.creditsConsumed,
        costTime: taskData.costTime,
      };
    }

    if (state === 'fail') {
      const failMsg = taskData.failMsg || taskData.msg || 'Generation failed';
      const failCode = taskData.failCode || '';
      throw new Error(formatKieError(
        { code: failCode || 501, msg: failMsg },
        taskId
      ));
    }
  }

  throw new Error(`Task timed out after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s [taskId: ${taskId}]`);
}

export async function generateWithKie(apiKey, model, input, onTaskId, onProgress) {
  const taskId = await createTask(apiKey, model, input);
  if (onTaskId) onTaskId(taskId);
  return pollUntilDone(apiKey, taskId, onProgress);
}

export async function uploadFileToKie(apiKey, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadPath', 'nodestudio');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${KIE_UPLOAD_BASE}/file-stream-upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.timeout = 300000;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.min(Math.round((event.loaded / event.total) * 100), 99));
        }
      };
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.code !== 200 && !data.success) {
          reject(new Error(data.msg || 'File upload failed'));
          return;
        }
        const fileUrl = data.data?.downloadUrl || data.data?.filePath;
        if (!fileUrl) {
          reject(new Error('No URL returned from file upload'));
          return;
        }
        if (onProgress) onProgress(100);
        resolve(fileUrl);
      } catch (e) {
        reject(new Error('Failed to parse upload response'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.ontimeout = () => reject(new Error('File upload timed out'));
    xhr.send(formData);
  });
}

export async function uploadFileUrl(apiKey, fileUrl) {
  const response = await fetch(`${KIE_UPLOAD_BASE}/file-url-upload`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      fileUrl,
      uploadPath: 'nodestudio',
    }),
  });

  const data = await response.json();
  if (data.code !== 200 && !data.success) {
    throw new Error(data.msg || 'URL upload failed');
  }
  return data.data?.downloadUrl || data.data?.filePath;
}

export async function getBalance(apiKey) {
  const response = await fetch(`${KIE_API_BASE}/chat/credit`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await response.json();
  if (isKieError(data)) {
    throw new Error(formatKieError(data));
  }
  return data.data || data;
}

export async function generateImage(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = { prompt: params.prompt };

  if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
  if (params.resolution) input.resolution = params.resolution;
  if (params.quality) input.quality = params.quality;

  if (modelDef?.kieInputMap) {
    for (const [from, to] of Object.entries(modelDef.kieInputMap)) {
      if (params[from] !== undefined) input[to] = params[from];
    }
  }

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}

export async function generateI2I(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = {};

  if (params.prompt) input.prompt = params.prompt;

  const imageField = modelDef?.kieImageField || 'input_image';
  if (params.image_url) {
    input[imageField] = params.image_url;
  } else if (params.images_list?.length > 0) {
    if (modelDef?.kieMultiImage) {
      input[modelDef.kieMultiImage] = params.images_list;
    } else {
      input[imageField] = params.images_list[0];
    }
  }

  if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
  if (params.resolution) input.resolution = params.resolution;

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}

export async function generateVideo(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = {};

  if (params.prompt) input.prompt = params.prompt;
  if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
  if (params.duration !== undefined) input.duration = String(params.duration);
  if (params.resolution) input.resolution = params.resolution;

  if (typeof params.sound === 'boolean') input.sound = params.sound;
  else if (typeof params.generate_audio === 'boolean') input.sound = params.generate_audio;

  if (params.image_url) {
    const imgField = modelDef?.kieImageField || 'image_url';
    input[imgField] = params.image_url;
  }

  if (params.images_list?.length > 0) {
    const imgListField = modelDef?.kieImageListField || 'image_urls';
    input[imgListField] = params.images_list;
  }

  if (modelDef?.kieInputMap) {
    for (const [from, to] of Object.entries(modelDef.kieInputMap)) {
      if (params[from] !== undefined) input[to] = params[from];
    }
  }

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}

export async function generateI2V(apiKey, params) {
  return generateVideo(apiKey, params);
}

export async function processV2V(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = {};

  if (params.video_url) {
    const videoField = modelDef?.kieVideoField || 'video_url';
    input[videoField] = params.video_url;
  }
  if (params.prompt) input.prompt = params.prompt;

  if (params.image_url) {
    const imgField = modelDef?.kieImageField || 'image_url';
    input[imgField] = params.image_url;
  }

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}

export async function processLipSync(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = {};

  if (params.audio_url) input.audio_url = params.audio_url;
  if (params.image_url) input.image_url = params.image_url;
  if (params.video_url) input.video_url = params.video_url;
  if (params.prompt) input.prompt = params.prompt;
  if (params.resolution) input.resolution = params.resolution;

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}

export async function generateAudio(apiKey, params) {
  const modelDef = params._modelDef;
  const kieModel = modelDef?.kieModel || params.model;
  const input = {};

  if (params.prompt) input.prompt = params.prompt;
  if (params.lyrics) input.lyrics = params.lyrics;
  if (params.style) input.style = params.style;
  if (params.title) input.title = params.title;

  if (modelDef?.kieInputMap) {
    for (const [from, to] of Object.entries(modelDef.kieInputMap)) {
      if (params[from] !== undefined) input[to] = params[from];
    }
  }

  if (modelDef?.kieExtraInput) {
    Object.assign(input, modelDef.kieExtraInput);
  }

  return generateWithKie(apiKey, kieModel, input, params.onTaskId, params.onProgress);
}
