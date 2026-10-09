<template>
  <el-dialog v-model="visible" title="Agent System Prompt" width="min(960px, calc(100vw - 32px))" alignCenter appendToBody :closeOnClickModal="false" :closeOnPressEscape="!saving" :showClose="!saving">
    <div v-if="loading" class="loadState" role="status">Loading system prompt...</div>
    <div v-else-if="loadError" class="loadState">
      <el-text type="danger" role="alert">{{ loadError }}</el-text>
      <el-button @click="loadPrompt">Retry</el-button>
    </div>
    <div v-else class="promptEditor">
      <div class="promptDescription">
        <p>Changes take effect from the next message after saving. Leave empty to use the default prompt.</p>
        <p v-pre>Keep {{tools}}, {{guidelines}}, {{environment}} and the related conditional blocks so tool rules and the runtime environment are filled in automatically.</p>
      </div>
      <el-input v-model="draft" class="promptInput" type="textarea" :maxlength="maxLength" showWordLimit resize="none" :disabled="saving" aria-label="Agent System Prompt" />
      <el-text v-if="saveError" type="danger" role="alert">{{ saveError }}</el-text>
    </div>
    <template #footer>
      <div class="dialogFooter">
        <el-button :disabled="loading || !!loadError || saving" @click="draft = defaultSystemPrompt">Restore Default</el-button>
        <div>
          <el-button :disabled="saving" @click="visible = false">Cancel</el-button>
          <el-button type="primary" :loading="saving" :disabled="loading || !!loadError || !maxLength || draft.length > maxLength" @click="save">Save</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { saveSettings, settings } from "@/stores/settings";

const visible = defineModel<boolean>({ default: false });
const draft = ref("");
const defaultSystemPrompt = ref("");
const maxLength = ref(0);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const saveError = ref("");
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());
onMounted(loadPrompt);

async function loadPrompt() {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const { data } = await axios.get<{ code: number; data: { defaultSystemPrompt: string; maxLength: number }; message?: string }>("/api/settings/systemPrompt", {
      headers: { "x-toonflow-workspace": "1", "Cache-Control": "no-cache" }, signal: controller.signal,
    });
    if (data.code !== 200) throw new Error(data.message || "Failed to load the system prompt");
    if (typeof data.data?.defaultSystemPrompt !== "string" || !Number.isSafeInteger(data.data.maxLength) || data.data.maxLength <= 0) {
      throw new Error("Invalid system prompt format");
    }
    defaultSystemPrompt.value = data.data.defaultSystemPrompt;
    maxLength.value = data.data.maxLength;
    const saved = settings.value.agentSystemPrompt;
    draft.value = typeof saved === "string" && saved.trim() ? saved : defaultSystemPrompt.value;
  } catch (error) {
    loadError.value = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || "Failed to load the system prompt. Please try again" : error instanceof Error ? error.message : "Failed to load the system prompt. Please try again";
  } finally { loading.value = false; }
}

async function save() {
  if (saving.value || loading.value || loadError.value || !maxLength.value || draft.value.length > maxLength.value) return;
  const agentSystemPrompt = !draft.value.trim() || draft.value === defaultSystemPrompt.value ? "" : draft.value;
  saving.value = true;
  saveError.value = "";
  try {
    await saveSettings(() => ({ agentSystemPrompt }));
    ElMessage.success("System prompt saved");
    visible.value = false;
  } catch (error) {
    saveError.value = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || "Failed to save. Please try again; your current content has been kept" : error instanceof Error ? error.message : "Failed to save. Please try again; your current content has been kept";
  } finally { saving.value = false; }
}
</script>

<style lang="scss" scoped>
.loadState {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 120px;
}

.promptEditor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: min(640px, 65dvh);
  min-height: 0;

  .promptDescription {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
    p { margin: 0; }
  }

  .promptInput {
    flex: 1;
    min-height: 0;
    :deep(.el-textarea__inner) { height: 100%; }
  }
}

.dialogFooter {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>
