import conf from "@/utils/conf";
import { fetchProviderModels } from "@/utils/ai/models";

let initialization: Promise<void> | undefined;

function normalizeApiKey(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^Bearer(?:\s+|$)/i, "").trim() : "";
}

export async function refreshProviderModels(previousSettings?: Record<string, unknown>) {
  const errors: string[] = [];
  const providers = conf.get("settings.customProviders");
  if (!Array.isArray(providers)) return { ...(errors.length ? { modelRefreshErrors: errors } : {}) };
  const previousProviders = previousSettings?.customProviders;
  const changed: number[] = [];
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (!provider || typeof provider.id !== "string" || typeof provider.apiUrl !== "string" || typeof provider.protocol !== "string") continue;
    const apiKey = normalizeApiKey(provider.apiKey);
    if (!apiKey) continue;
    if (previousSettings) {
      const prev = Array.isArray(previousProviders) ? previousProviders.find((item: { id?: string }) => item?.id === provider.id) : undefined;
      if (prev && apiKey === normalizeApiKey(prev.apiKey) && provider.apiUrl === prev.apiUrl && provider.protocol === prev.protocol) continue;
    }
    changed.push(i);
  }
  if (!changed.length) return { ...(errors.length ? { modelRefreshErrors: errors } : {}) };
  const results = await Promise.allSettled(changed.map(async i => {
    const provider = providers[i];
    const models = await fetchProviderModels({ apiUrl: provider.apiUrl, protocol: provider.protocol, apiKey: provider.apiKey });
    if (!models.length) return;
    return { index: i, id: provider.id, models };
  }));
  let updated = false;
  const current = conf.get("settings.customProviders");
  if (!Array.isArray(current)) return { ...(errors.length ? { modelRefreshErrors: errors } : {}) };
  const merged = current.map((item: Record<string, unknown>) => {
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { id, models } = result.value;
      if (item?.id === id) {
        updated = true;
        return { ...item, models };
      }
    }
    return item;
  });
  for (const result of results) {
    if (result.status === "rejected") errors.push(`Model refresh failed: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
  }
  if (updated) conf.set("settings.customProviders", merged);
  return {
    ...(updated ? { customProviders: conf.get("settings.customProviders") as typeof merged } : {}),
    ...(errors.length ? { modelRefreshErrors: errors } : {}),
  };
}

export default function initializeProviderModels() {
  return initialization ??= refreshProviderModels().then(result => {
    result.modelRefreshErrors?.forEach(error => console.warn(error));
  });
}
