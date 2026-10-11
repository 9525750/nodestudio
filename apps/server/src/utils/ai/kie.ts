import { fetchProviderModels } from "@/utils/ai/models";

export const kieApiKey = "cf3158422e4a71de3c2d4e27fc371008";
export const kieApiUrl = "https://api.kie.ai/v1";
export const kieCreateTaskUrl = "https://api.kie.ai/api/v1/jobs/createTask";
export const kieRecordInfoUrl = "https://api.kie.ai/api/v1/jobs/recordInfo";
export const kieProviderId = "kie";
export const kieProviderLabel = "KIE";
export const kieProtocol = "openai-completions" as const;

let cachedModels: { id: string; label: string; type?: string; contextWindow?: number; maxOutputTokens?: number }[] = [];

export function getKieTextModels() {
  return cachedModels;
}

export async function refreshKieModels() {
  const models = await fetchProviderModels({ apiUrl: kieApiUrl, protocol: kieProtocol, apiKey: kieApiKey });
  cachedModels = models;
  return models;
}
