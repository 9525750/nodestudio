import { mkdir, readFile, realpath, stat, unlink } from "@toonflow/file";
import { join, relative } from "node:path";
import type { GeneratedMedia, MediaGenerationRequest, MediaModel, MediaReference } from "@toonflow/tools-scaffold/runtime";
import { kieApiKey, kieCreateTaskUrl, kieRecordInfoUrl } from "@/utils/ai/kie";
import { lockWorkspaceFiles, resolveWorkspacePath, writeWorkspaceFile } from "@/utils/workspace/files";

const maxMediaSize = 100 * 1024 * 1024;
const mediaExtensions: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "image/avif": "avif", "image/bmp": "bmp", "image/tiff": "tiff",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm",
  "audio/flac": "flac", "audio/aac": "aac", "audio/mp4": "m4a", "audio/opus": "opus", "audio/pcm": "pcm",
};


const videoDurations = [
  { duration: [5, 10], resolution: ["720p", "1080p"] },
];

const kieMediaModels: MediaModel[] = [
  { providerId: "kie", providerLabel: "KIE", modelId: "kling-3.0/video", label: "Kling 3.0", type: "video", mode: ["text", "singleImage", "endFrameOptional"], durationResolutionMap: videoDurations },
  { providerId: "kie", providerLabel: "KIE", modelId: "bytedance/seedance-2-5", label: "Seedance 2.5", type: "video", mode: ["text", "singleImage"], durationResolutionMap: videoDurations },
  { providerId: "kie", providerLabel: "KIE", modelId: "google/gemini-omni-flash-1-1", label: "Gemini Omni Flash", type: "video", mode: ["text"], durationResolutionMap: [{ duration: [5, 10], resolution: ["720p"] }] },
  { providerId: "kie", providerLabel: "KIE", modelId: "veo-3-1", label: "Veo 3.1", type: "video", mode: ["text", "singleImage"], durationResolutionMap: [{ duration: [5, 10], resolution: ["720p", "1080p"] }], audio: "optional" },
  { providerId: "kie", providerLabel: "KIE", modelId: "grok-imagine/text-to-video", label: "Grok Imagine", type: "video", mode: ["text"], durationResolutionMap: [{ duration: [5], resolution: ["720p", "1080p"] }] },
  { providerId: "kie", providerLabel: "KIE", modelId: "nano-banana-pro", label: "Nano Banana Pro", type: "image", imageSizes: ["1024x1024", "1024x1536", "1536x1024"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
  { providerId: "kie", providerLabel: "KIE", modelId: "4o-image-api", label: "GPT Image", type: "image", imageSizes: ["1024x1024", "1024x1536", "1536x1024"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
];

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function detectMimeType(bytes: Uint8Array, fallback: string) {
  const header = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 16));
  const text = header.toString("ascii");
  const mimeType = fallback.split(";")[0].trim().toLowerCase();
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return "image/jpeg";
  if (/^GIF8[79]a/.test(text)) return "image/gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return "audio/wav";
  if (text.startsWith("fLaC")) return "audio/flac";
  if (text.startsWith("OggS")) return mimeType.startsWith("video/") ? "video/ogg" : mimeType === "audio/opus" ? "audio/opus" : "audio/ogg";
  if (header[0] === 0xff && (header[1]! & 0xf6) === 0xf0) return "audio/aac";
  if (text.startsWith("ID3") || (header[0] === 0xff && (header[1]! & 0xe0) === 0xe0 && (header[1]! & 0x06) !== 0)) return "audio/mpeg";
  if (text.slice(4, 8) === "ftyp") {
    if (/avif|avis/.test(text.slice(8))) return "image/avif";
    if (/^M4[AB] $/.test(text.slice(8, 12)) || mimeType.startsWith("audio/")) return "audio/mp4";
    return text.slice(8, 12) === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return mimeType.startsWith("audio/") ? "audio/webm" : "video/webm";
  return ({ "image/jpg": "image/jpeg", "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/x-flac": "audio/flac" } as Record<string, string>)[mimeType] ?? mimeType;
}

export async function readReference(cwd: string, reference: MediaReference, mediaType: string, signal?: AbortSignal): Promise<{ type: "base64"; data: string; mimeType: string }> {
  signal?.throwIfAborted();
  const { path } = await resolveWorkspacePath(cwd, reference.path);
  const info = await stat(path);
  if (!info.isFile() || info.size > maxMediaSize) invalid("Reference media must be a file no larger than 100 MB");
  const bytes = await readFile(path, { signal });
  if (!bytes.length || bytes.length > maxMediaSize) invalid("Reference media is empty or exceeds 100 MB");
  const mimeType = detectMimeType(bytes, reference.mimeType);
  if (!mimeType.startsWith(`${mediaType}/`)) invalid(`Reference media must be of type ${mediaType}`);
  return { type: "base64", data: bytes.toString("base64"), mimeType };
}

export function listMediaModels(): MediaModel[] {
  return kieMediaModels;
}

// ACT: KIE использует асинхронный job API. Polling с экспоненциальным интервалом, потолок 15 с.
const kiePollIntervalMs = 3000;
const kiePollMaxIntervalMs = 15000;
const kiePollTimeoutMs = 600000;

async function createKieTask(modelId: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const response = await fetch(kieCreateTaskUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${kieApiKey}` },
    body: JSON.stringify({ model: modelId, input }),
    signal,
  });
  if (!response.ok) {
    let detail = "";
    try { const err = await response.json() as Record<string, unknown>; detail = err?.msg as string || ""; } catch {}
    throw new Error(detail || `KIE createTask failed (HTTP ${response.status})`);
  }
  const result = await response.json() as { code: number; msg: string; data?: { taskId?: string } };
  if (result.code !== 200 || !result.data?.taskId) throw new Error(result.msg || "KIE createTask returned no taskId");
  return result.data.taskId;
}

async function pollKieTask(taskId: string, signal?: AbortSignal): Promise<string[]> {
  const deadline = Date.now() + kiePollTimeoutMs;
  let interval = kiePollIntervalMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, interval));
    signal?.throwIfAborted();
    const response = await fetch(`${kieRecordInfoUrl}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieApiKey}` },
      signal,
    });
    if (!response.ok) throw new Error(`KIE recordInfo failed (HTTP ${response.status})`);
    const result = await response.json() as {
      code: number;
      data?: { state?: string; resultJson?: string; failMsg?: string | null };
    };
    const data = result.data;
    if (!data) throw new Error("KIE recordInfo returned no data");
    if (data.state === "fail") throw new Error(data.failMsg || "Media generation failed");
    if (data.state === "success" && data.resultJson) {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      if (!parsed.resultUrls?.length) throw new Error("KIE returned no result URLs");
      return parsed.resultUrls;
    }
    interval = Math.min(interval * 1.5, kiePollMaxIntervalMs);
  }
  throw new Error("Media generation timed out");
}

function buildKieInput(mediaType: "image" | "video" | "audio", request: MediaGenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt: request.prompt };
  if (mediaType === "video") {
    if (request.ratio) input.aspect_ratio = request.ratio;
    input.duration = request.duration ?? 5;
    if (request.resolution) input.resolution = request.resolution;
  } else if (mediaType === "image") {
    if (request.ratio) input.aspect_ratio = request.ratio;
    if (request.size) input.size = request.size;
  }
  return input;
}

async function downloadAsset(url: string, signal?: AbortSignal) {
  if (!/^https?:\/\//i.test(url)) invalid("Generated result must use an HTTP or HTTPS URL");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Failed to download generated result (HTTP ${response.status})`);
  if (Number(response.headers.get("content-length")) > maxMediaSize) {
    await response.body?.cancel();
    invalid("Generated file cannot exceed 100 MB");
  }
  const reader = response.body?.getReader();
  if (!reader) invalid("Generated result is empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxMediaSize) invalid("Generated file cannot exceed 100 MB");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return { bytes: Buffer.concat(chunks, size), mimeType: response.headers.get("content-type") ?? "" };
}

export async function generateMedia(
  cwd: string,
  mediaType: "image" | "video" | "audio",
  request: MediaGenerationRequest,
  signal?: AbortSignal,
): Promise<GeneratedMedia[]> {
  signal?.throwIfAborted();
  if (!request.prompt.trim()) invalid("Please enter a generation prompt");
  const directory = await realpath(cwd);
  const outputDirectory = request.outputDirectory ?? "assets/generated";
  await resolveWorkspacePath(directory, outputDirectory, true);

  const model = kieMediaModels.find(m => m.modelId === request.modelId);
  if (!model) invalid("Selected media model not found");

  const input = buildKieInput(mediaType, request);
  const taskId = await createKieTask(request.modelId, input, signal);
  const resultUrls = await pollKieTask(taskId, signal);

  const written: string[] = [];
  const result: GeneratedMedia[] = [];
  try {
    for (const url of resultUrls) {
      signal?.throwIfAborted();
      const { bytes, mimeType: rawMimeType } = await downloadAsset(url, signal);
      const mimeType = detectMimeType(bytes, rawMimeType);
      const expectedPrefix = `${mediaType}/`;
      if (!mimeType.startsWith(expectedPrefix) || !mediaExtensions[mimeType]) {
        // ACT: KIE может вернуть MIME, не совпадающий с запрошенным типом; используем расширение из URL или fallback.
        const ext = mediaExtensions[mimeType] ?? url.split(".").pop()?.split("?")[0] ?? "bin";
        const file = join(outputDirectory, `${mediaType}${crypto.randomUUID()}.${ext}`);
        const output = await resolveWorkspacePath(directory, outputDirectory, true);
        const release = lockWorkspaceFiles([output.path]);
        try {
          await mkdir(output.path, { recursive: true });
          const { path } = await resolveWorkspacePath(directory, file);
          signal?.throwIfAborted();
          await writeWorkspaceFile(path, bytes, true);
          written.push(path);
          result.push({ path: relative(directory, path).replace(/\\/g, "/"), mimeType, mediaType });
        } finally { release(); }
        continue;
      }
      signal?.throwIfAborted();
      const output = await resolveWorkspacePath(directory, outputDirectory, true);
      const release = lockWorkspaceFiles([output.path]);
      try {
        await mkdir(output.path, { recursive: true });
        const file = join(outputDirectory, `${mediaType}${crypto.randomUUID()}.${mediaExtensions[mimeType]}`);
        const { path } = await resolveWorkspacePath(directory, file);
        signal?.throwIfAborted();
        await writeWorkspaceFile(path, bytes, true);
        written.push(path);
        result.push({ path: relative(directory, path).replace(/\\/g, "/"), mimeType, mediaType });
      } finally { release(); }
    }
    signal?.throwIfAborted();
    return result;
  } catch (err) {
    await Promise.all(written.map(path => unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; })));
    throw err;
  }
}
