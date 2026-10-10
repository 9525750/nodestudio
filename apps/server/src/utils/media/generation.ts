import { mkdir, readFile, realpath, stat, unlink } from "@toonflow/file";
import { join, relative } from "node:path";
import type { GeneratedMedia, MediaGenerationRequest, MediaModel, MediaReference } from "@toonflow/tools-scaffold/runtime";
import conf from "@/utils/conf";
import { providerSchema } from "@/utils/ai";
import { z } from "zod";
import { lockWorkspaceFiles, resolveWorkspacePath, writeWorkspaceFile } from "@/utils/workspace/files";

const maxMediaSize = 100 * 1024 * 1024;
const mediaExtensions: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "image/avif": "avif", "image/bmp": "bmp", "image/tiff": "tiff",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm",
  "audio/flac": "flac", "audio/aac": "aac", "audio/mp4": "m4a", "audio/opus": "opus", "audio/pcm": "pcm",
};

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

const providerWithIdSchema = providerSchema.extend({ id: z.string().min(1), label: z.string() });

export function listMediaModels(): MediaModel[] {
  const providers = conf.get("settings", {}).customProviders;
  if (!Array.isArray(providers)) return [];
  return providers.flatMap(item => {
    const parsed = providerWithIdSchema.safeParse(item);
    if (!parsed.success) return [];
    const provider = parsed.data;
    return provider.models
      .filter(model => model.id.trim() && (model as { type?: string }).type && ["image", "video", "audio"].includes((model as { type?: string }).type!))
      .map(model => ({
        providerId: provider.id,
        providerLabel: provider.label,
        modelId: model.id,
        label: model.label,
        type: (model as { type?: string }).type as "image" | "video" | "audio",
      }));
  });
}

function getMediaProvider(providerId: string, modelId: string) {
  const providers = conf.get("settings", {}).customProviders;
  const parsed = providerWithIdSchema.safeParse(Array.isArray(providers) ? providers.find(item => item?.id === providerId) : undefined);
  if (!parsed.success) invalid("Please configure the API provider in settings first");
  const provider = parsed.data;
  const model = provider.models.find(item => item.id === modelId);
  if (!model) invalid("Selected media model not found, please select again");
  const baseUrl = new URL(provider.apiUrl);
  if (baseUrl.pathname === "/") baseUrl.pathname = "/v1";
  return { provider, model, baseUrl: baseUrl.href.replace(/\/+$/, "") };
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

type MediaAsset = { url: string; mimeType?: string } | { b64_json: string; mimeType?: string };

async function assetBytes(asset: MediaAsset, mediaType: "image" | "video" | "audio", signal?: AbortSignal) {
  let bytes: Uint8Array;
  let mimeType = asset.mimeType ?? "";
  if ("url" in asset && asset.url) {
    const result = await downloadAsset(asset.url, signal);
    bytes = result.bytes;
    const responseMimeType = result.mimeType.split(";")[0].trim().toLowerCase();
    mimeType = responseMimeType && responseMimeType !== "application/octet-stream" ? result.mimeType : mimeType;
  } else if ("b64_json" in asset && asset.b64_json) {
    const content = asset.b64_json.replace(/\s/g, "");
    if (content.length > Math.ceil(maxMediaSize / 3) * 4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(content) || content.length % 4 === 1) invalid("Generated result base64 content is invalid or exceeds 100 MB");
    bytes = Buffer.from(content, "base64");
  } else { return invalid("Provider returned an invalid media result"); }
  if (!bytes.byteLength || bytes.byteLength > maxMediaSize) invalid("Generated file is empty or exceeds 100 MB");
  mimeType = detectMimeType(bytes, mimeType);
  if (!mimeType.startsWith(`${mediaType}/`) || !mediaExtensions[mimeType]) invalid("Generated result is not a supported image, video, or audio format");
  return { bytes, mimeType };
}

async function callAggregator(
  baseUrl: string,
  apiKey: string,
  mediaType: "image" | "video" | "audio",
  request: MediaGenerationRequest,
  signal?: AbortSignal,
): Promise<MediaAsset[]> {
  const endpoint = mediaType === "image" ? `${baseUrl}/images/generations`
    : mediaType === "video" ? `${baseUrl}/videos/generations`
    : `${baseUrl}/audio/speech`;
  const body: Record<string, unknown> = { model: request.modelId, prompt: request.prompt };
  if (mediaType === "image") {
    if (request.size) body.size = request.size;
    else if (request.ratio) body.aspect_ratio = request.ratio;
    body.response_format = "url";
  } else if (mediaType === "video") {
    if (request.ratio) body.aspect_ratio = request.ratio;
    if (request.resolution) body.resolution = request.resolution;
    if (request.duration) body.duration = request.duration;
    if (request.mode) body.mode = request.mode;
  } else {
    body.input = request.prompt;
    if (request.voice) body.voice = request.voice;
    if (request.speed) body.speed = request.speed;
    if (request.format) body.response_format = request.format;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!response.ok) {
    let detail = "";
    try { const err = await response.json() as Record<string, unknown>; detail = (err?.error as Record<string, unknown>)?.message as string || err?.message as string || ""; } catch {}
    throw new Error(detail || `Media generation failed (HTTP ${response.status})`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const result = await response.json() as { data?: MediaAsset[] };
    const items = Array.isArray(result.data) ? result.data : [result as unknown as MediaAsset];
    if (!items.length) invalid("Provider returned no results");
    return items;
  }
  // ACT: audio/speech often returns binary directly
  const reader = response.body?.getReader();
  if (!reader) invalid("Provider returned an empty response");
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
  return [{ b64_json: Buffer.concat(chunks, size).toString("base64"), mimeType: contentType.split(";")[0].trim() }];
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
  const { provider, baseUrl } = getMediaProvider(request.providerId, request.modelId);
  const assets = await callAggregator(baseUrl, provider.apiKey, mediaType, request, signal);
  const written: string[] = [];
  const result: GeneratedMedia[] = [];
  try {
    for (const asset of assets) {
      signal?.throwIfAborted();
      const { bytes, mimeType } = await assetBytes(asset, mediaType, signal);
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
