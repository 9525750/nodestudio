import { z } from "zod";

const modelSchema = z.object({
  id: z.string().optional(), name: z.string().optional(),
  display_name: z.string().optional(), displayName: z.string().optional(),
  type: z.string().optional(), object: z.string().optional(),
  inputTokenLimit: z.number().int().positive().optional(),
  outputTokenLimit: z.number().int().positive().optional(),
});

const imagePattern = /\b(dall-e|stable-diffusion|sdxl|sd3|flux|midjourney|kandinsky|imagen|ideogram|recraft|playground)\b/i;
const videoPattern = /\b(sora|runway|kling|cogvideo|wan|seedance|luma|pika|minimax-video|hailuo|gen-3|mochi|hunyuan-video|vidu)\b/i;
const audioPattern = /\b(tts|whisper|suno|bark|musicgen|audiogen|speech|kokoro|fish-speech|chatTTS|cosyvoice)\b/i;

function classifyModel(id: string, serverType?: string): "text" | "image" | "video" | "audio" | undefined {
  if (serverType === "image" || serverType === "video" || serverType === "audio" || serverType === "text") return serverType;
  if (imagePattern.test(id)) return "image";
  if (videoPattern.test(id)) return "video";
  if (audioPattern.test(id)) return "audio";
  return undefined;
}

export async function fetchProviderModels({ apiUrl, protocol, apiKey }: { apiUrl: string; protocol: string; apiKey: string }) {
  const url = new URL(apiUrl);
  if (url.pathname === "/") url.pathname = "/v1";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (protocol === "anthropic-messages") {
    headers["anthropic-version"] = "2023-06-01";
    headers["x-api-key"] = apiKey;
    url.searchParams.set("limit", "1000");
  } else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const models = new Map<string, { id: string; label: string; type?: string; contextWindow?: number; maxOutputTokens?: number }>();
  const cursors = new Set<string>();
  const signal = AbortSignal.timeout(30000);
  while (true) {
    const response = await fetch(url, { headers, signal, redirect: "error" });
    if (!response.ok) throw new Error(`Failed to fetch model list (HTTP ${response.status}). Check API URL, protocol, and key`);
    const result = z.object({
      data: z.array(modelSchema),
      has_more: z.boolean().optional(), last_id: z.string().nullable().optional(),
    }).parse(await response.json());
    const items = result.data;
    for (const item of items) {
      const id = item.id?.trim();
      if (!id) throw new Error("Model list contains an invalid model ID");
      const type = classifyModel(id, item.type ?? item.object);
      models.set(id, { id, label: item.display_name || item.displayName || id, type, contextWindow: item.inputTokenLimit, maxOutputTokens: item.outputTokenLimit });
    }
    const cursor = protocol === "anthropic-messages" && result.has_more ? result.last_id : undefined;
    if (protocol === "anthropic-messages" && result.has_more && !cursor) throw new Error("Model list is missing a pagination cursor");
    if (!cursor) break;
    if (cursors.has(cursor)) throw new Error("Model list has a duplicate pagination cursor");
    cursors.add(cursor);
    url.searchParams.set("after_id", cursor);
  }
  return [...models.values()];
}
