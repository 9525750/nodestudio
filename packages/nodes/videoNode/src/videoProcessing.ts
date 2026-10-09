import type { BrowserFfmpegCommand, BrowserFfmpegFactory, FfprobeData } from "@toonflow/ffmpeg/browser";

export type VideoProcessingOptions = {
  action: "extractAudio" | "separate" | "trim";
  audioPath?: string;
  videoPath?: string;
  start?: number;
  end?: number;
};

function normalizePath(path: string) {
  if (!path || /[\x00-\x1f]/.test(path) || /^(?:[\\/]|[a-z][a-z\d+.-]*:)/i.test(path) || path.split(/[\\/]+/).includes("..")) {
    throw new Error("Video processing must use workspace-relative paths");
  }
  return path.split(/[\\/]+/).filter(part => part && part !== ".").join("/").toLowerCase();
}

function probeMedia(ffmpeg: BrowserFfmpegFactory, path: string, signal?: AbortSignal) {
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

/** Directory creation, unique file names, and failure cleanup are the caller's responsibility; the original video is always preserved. */
export async function processVideo(ffmpeg: BrowserFfmpegFactory, source: string, options: VideoProcessingOptions, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const sourcePath = normalizePath(source);
  if (!["extractAudio", "separate", "trim"].includes(options.action)) throw new Error("Unknown video processing action");
  const needsAudio = options.action !== "trim";
  const needsVideo = options.action !== "extractAudio";
  if (needsAudio && !options.audioPath) throw new Error("Missing audio track output path");
  if (needsVideo && !options.videoPath) throw new Error("Missing video output path");
  const outputs = [needsAudio ? options.audioPath : undefined, needsVideo ? options.videoPath : undefined].filter((path): path is string => !!path).map(normalizePath);
  if (outputs.includes(sourcePath) || new Set(outputs).size !== outputs.length) throw new Error("Output files must not overwrite the source video or each other");

  const media = await probeMedia(ffmpeg, source, signal);
  const video = media.streams.find(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  if (!video) throw new Error("File does not contain video content");
  const duration = Number(media.format.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Cannot read a valid video duration");
  if (needsAudio && !media.streams.some(stream => stream.codec_type === "audio")) throw new Error("This video has no audio track");
  if (options.action === "trim" && (!Number.isFinite(options.start) || !Number.isFinite(options.end)
    || options.start! < 0 || options.end! <= options.start! || options.end! > duration)) {
    throw new Error("Trim range must satisfy 0 <= start time < end time <= video duration");
  }

  const command = ffmpeg(source);
  if (options.action === "trim") command.seekInput(options.start!);
  if (needsAudio) {
    command.output(options.audioPath!).noVideo().audioCodec("aac").audioBitrate(192).format("ipod")
      .outputOptions("-map", "0:a:0", "-movflags", "+faststart");
  }
  if (needsVideo) {
    // ACT: Re-encode to H.264 for frame-accurate trimming and player compatibility; odd dimensions are only padded to even, not stretched.
    command.output(options.videoPath!).videoCodec("libx264").format("mp4")
      .videoFilters("pad=ceil(iw/2)*2:ceil(ih/2)*2")
      .outputOptions("-map", `0:${video.index}`, "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
    if (options.action === "separate") command.noAudio();
    else command.duration(options.end! - options.start!).audioCodec("aac").audioBitrate(192).outputOptions("-map", "0:a:0?");
  }
  await runCommand(command, signal);
  const result = await probeMedia(ffmpeg, needsVideo ? options.videoPath! : options.audioPath!, signal);
  const resultVideo = result.streams.find(stream => stream.codec_type === "video");
  const resultDuration = Number(result.format.duration);
  if (!Number.isFinite(resultDuration) || resultDuration <= 0 || (needsVideo && !resultVideo)) throw new Error("Generated media file is invalid");
  return { duration: resultDuration, width: resultVideo?.width ?? video.width, height: resultVideo?.height ?? video.height };
}
