import type { BrowserFfmpegCommand, BrowserFfmpegFactory, FfprobeData } from "@toonflow/ffmpeg/browser";

export type AudioSegment = { start: number; end: number };
export type AudioProcessingOptions = { outputPath: string } & (
  { action: "speed"; speed: number } | { action: "clip"; segments: AudioSegment[] }
);

function normalizePath(path: string) {
  if (!path || /[\x00-\x1f]/.test(path) || /^(?:[\\/]|[a-z][a-z\d+.-]*:)/i.test(path) || path.split(/[\\/]+/).includes("..")) {
    throw new Error("Audio processing must use a workspace-relative path");
  }
  const normalized = path.split(/[\\/]+/).filter(part => part && part !== ".").join("/").toLowerCase();
  if (!normalized) throw new Error("Audio processing path cannot be empty");
  return normalized;
}

function probeAudio(ffmpeg: BrowserFfmpegFactory, path: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const command = ffmpeg(path);
  const cancel = () => command.kill();
  signal?.addEventListener("abort", cancel, { once: true });
  return new Promise<FfprobeData>((resolve, reject) => {
    command.ffprobe((error, data) => {
      if (signal?.aborted) reject(signal.reason);
      else if (error) reject(error);
      else resolve(data);
    });
  }).finally(() => signal?.removeEventListener("abort", cancel));
}

function runCommand(command: BrowserFfmpegCommand, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const cancel = () => command.kill();
  signal?.addEventListener("abort", cancel, { once: true });
  return new Promise<void>((resolve, reject) => {
    command.on("start", () => { if (signal?.aborted) command.kill(); });
    command.on("error", error => reject(signal?.aborted ? signal.reason : error));
    command.on("end", () => signal?.aborted ? reject(signal.reason) : resolve());
    command.run();
  }).finally(() => signal?.removeEventListener("abort", cancel));
}

/** Caller is responsible for output directory, unique filename, and failure cleanup; result does not overwrite original audio. */
export async function processAudio(ffmpeg: BrowserFfmpegFactory, source: string, options: AudioProcessingOptions, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (normalizePath(source) === normalizePath(options.outputPath)) throw new Error("Output file cannot overwrite original audio");
  if (!["speed", "clip"].includes(options.action)) throw new Error("Unknown audio processing action");
  if (options.action === "speed" && (!Number.isFinite(options.speed) || options.speed < 0.1 || options.speed > 4)) {
    throw new Error("Audio speed must be between 0.1x and 4x");
  }
  const media = await probeAudio(ffmpeg, source, signal);
  const audio = media.streams.find(stream => stream.codec_type === "audio");
  if (!audio) throw new Error("File does not contain an audio track");
  const duration = Math.max(...[audio.duration, media.format.duration].map(Number).filter(value => Number.isFinite(value) && value > 0));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Cannot read a valid audio duration");
  if (options.action === "clip" && (!Array.isArray(options.segments) || options.segments.length === 0
    || options.segments.some(segment => !segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)
      || segment.start < 0 || segment.end <= segment.start || segment.end > duration))) {
    throw new Error("Each segment must satisfy 0 <= start < end <= audio duration");
  }

  const command = ffmpeg(source).output(options.outputPath).noVideo().audioCodec("aac").audioBitrate(192).format("ipod")
    .outputOptions("-movflags", "+faststart");
  if (options.action === "speed") {
    let tempo = options.speed;
    const filters: string[] = [];
    // ACT: Each stage stays within 0.5-2x to avoid high-ratio atempo skipping samples, covering down to 0.1x speed.
    while (tempo < 0.5) { filters.push("atempo=0.5"); tempo /= 0.5; }
    while (tempo > 2) { filters.push("atempo=2"); tempo /= 2; }
    command.audioFilters([...filters, `atempo=${tempo}`]).outputOptions("-map", "0:a:0");
  } else {
    const filters = options.segments.map((segment, index) =>
      `[0:a:0]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[part${index}]`);
    filters.push(`${options.segments.map((_segment, index) => `[part${index}]`).join("")}concat=n=${options.segments.length}:v=0:a=1[result]`);
    command.complexFilter(filters).outputOptions("-map", "[result]");
  }
  await runCommand(command, signal);
  const result = await probeAudio(ffmpeg, options.outputPath, signal);
  const resultDuration = Number(result.format.duration);
  if (!Number.isFinite(resultDuration) || resultDuration <= 0 || !result.streams.some(stream => stream.codec_type === "audio")) {
    throw new Error("Generated audio file is invalid");
  }
  return { duration: resultDuration };
}
