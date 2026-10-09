import { computed } from "vue";
import { defineStore } from "pinia";
import { customProviders, saveSettings, settings } from "@/stores/settings";

export const useHelloStore = defineStore("hello", () => {
  const completed = computed(() => settings.value.helloCompleted === true);

  async function load() {
    if (typeof settings.value.helloCompleted === "boolean") return completed.value;
    let previouslyCompleted = false;
    try {
      previouslyCompleted = JSON.parse(localStorage.getItem("toonflow.hello") ?? "null")?.completed === true;
    } catch {
      // ACT: When old cache is unreadable, recover from configured models; localStorage can't migrate across desktop random ports.
    }
    if (previouslyCompleted || customProviders.value.some(provider => typeof provider.apiKey === "string" && provider.apiKey.trim() && provider.models.length))
      await complete();
    return completed.value;
  }

  async function complete() {
    await saveSettings(() => ({ helloCompleted: true }));
  }

  async function reset() {
    await saveSettings(() => ({ helloCompleted: false }));
  }

  return { completed, load, complete, reset };
});
