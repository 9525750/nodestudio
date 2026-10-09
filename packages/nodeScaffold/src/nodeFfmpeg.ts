import { inject, onScopeDispose } from "vue";
import { createBrowserFfmpeg } from "@toonflow/ffmpeg/browser";

export type { BrowserFfmpegFactory, BrowserFfmpegCommand, BrowserFfmpegOptions, FfprobeData } from "@toonflow/ffmpeg/browser";

export function useNodeFfmpeg() {
  const getDirectory = inject<(() => string) | undefined>("workspaceDirectory", undefined);
  const lifetime = new AbortController();
  onScopeDispose(() => lifetime.abort());

  return (signal?: AbortSignal) => {
    if (!getDirectory) throw new Error("Current canvas does not provide a workspace directory");
    return createBrowserFfmpeg(getDirectory(), signal ? AbortSignal.any([lifetime.signal, signal]) : lifetime.signal);
  };
}
