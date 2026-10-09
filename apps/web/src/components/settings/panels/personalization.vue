<template>
  <div class="personalization">
    <section class="settingSection" aria-labelledby="instructionsTitle">
      <div class="settingInfo">
        <h3 id="instructionsTitle">Toonflow Instructions</h3>
        <p class="description">Provide additional instructions and context for all chats. Markdown is supported; changes take effect the next time you send a message after saving.</p>
      </div>
      <el-alert v-if="document.error" :title="getDocumentError(document)" type="error" :closable="false" showIcon />
      <el-input
        v-model="document.content"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 8 }"
        :maxlength="maxLength"
        :disabled="!document.loaded || document.loading"
        resize="none"
        aria-label="Toonflow instructions content" />
      <div class="editorFooter">
        <span class="editorStatus">
          {{ document.loading ? "Loading…" : isDirty(document) ? "Unsaved changes" : "" }}
          <span>{{ document.content.length }} / {{ maxLength }}</span>
        </span>
        <div class="editorActions">
          <el-button
            :icon="IconRefresh"
            :loading="document.loading"
            :disabled="document.saving"
            aria-label="Reload Toonflow instructions"
            @click="reloadDocument(document, 'agents')">
            {{ document.loaded ? "Reload" : "Retry" }}
          </el-button>
          <el-button
            type="primary"
            :icon="IconDeviceFloppy"
            :loading="document.saving"
            :disabled="!document.loaded || document.loading || document.conflict || !isDirty(document) || document.content.length > maxLength"
            aria-label="Save Toonflow instructions"
            @click="saveDocument(document, 'agents')">
            Save
          </el-button>
        </div>
      </div>
    </section>
    <section class="settingSection">
      <div class="memoryOptions">
        <div class="settingHeader">
          <div class="settingInfo">
            <h4>Enable Local Memory</h4>
            <p class="description">Remember your preferences and use them in later chats. Saved content is kept after turning this off.</p>
          </div>
          <el-switch
            :modelValue="memoryEnabled"
            :loading="savingMemorySetting"
            aria-label="Enable local memory"
            @change="(value) => setMemoryEnabled(value === true)" />
        </div>
        <div class="settingHeader">
          <div class="settingInfo">
            <h4>Delete Local Memory</h4>
          </div>
          <el-button
            :icon="IconTrash"
            :loading="memoryAction === 'delete'"
            :disabled="!!memoryAction || memoryDocument.loading || memoryDocument.saving"
            aria-label="Delete local memory"
            @click="deleteMemory">
            Delete
          </el-button>
        </div>
        <div class="settingHeader">
          <div class="settingInfo">
            <h4>View Local Memory</h4>
          </div>
          <el-button :icon="IconEye" :loading="memoryAction === 'view'" :disabled="!!memoryAction || memoryDocument.loading || memoryDocument.saving" aria-label="View local memory" @click="viewMemory">
            View
          </el-button>
        </div>
      </div>
    </section>
    <el-dialog v-model="memoryVisible" title="Toonflow Memory" width="min(760px, calc(100vw - 32px))" alignCenter appendToBody>
      <div class="memoryContent">
        <el-alert v-if="memoryDocument.error" :title="getDocumentError(memoryDocument)" type="error" :closable="false" showIcon />
        <el-input
          v-if="memoryEditing"
          v-model="memoryDocument.content"
          type="textarea"
          :autosize="{ minRows: 10, maxRows: 18 }"
          :maxlength="maxLength"
          :disabled="memoryDocument.loading"
          resize="none"
          aria-label="Local memory content" />
        <messageMarkdown v-else-if="memoryDocument.content.trim()" :content="memoryDocument.content" />
        <el-empty v-else description="No local memory yet" :imageSize="80" />
      </div>
      <template #footer>
        <div class="memoryFooter">
          <span class="editorStatus">
            {{ isDirty(memoryDocument) ? "Unsaved changes · " : "" }}{{ memoryDocument.content.length }} / {{ maxLength }}
          </span>
          <div class="editorActions">
            <el-button
              :icon="IconRefresh"
              :loading="memoryDocument.loading"
              :disabled="memoryDocument.saving"
              aria-label="Reload local memory"
              @click="reloadDocument(memoryDocument, 'memory')">
              Reload
            </el-button>
            <el-button
              v-if="memoryEditing"
              type="primary"
              :icon="IconDeviceFloppy"
              :loading="memoryDocument.saving"
              :disabled="memoryDocument.loading || memoryDocument.conflict || !isDirty(memoryDocument) || memoryDocument.content.length > maxLength"
              aria-label="Save local memory"
              @click="saveMemory">
              Save
            </el-button>
            <el-button v-else type="primary" :icon="IconEdit" :disabled="memoryDocument.loading" aria-label="Edit local memory" @click="memoryEditing = true">
              Edit
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { msg, translate } from "@toonflow/i18n/vue";
import { computed, onActivated, reactive, ref, watch } from "vue";
import axios from "axios";
import { ElMessage, ElMessageBox } from "element-plus";
import { IconDeviceFloppy, IconEdit, IconEye, IconRefresh, IconTrash } from "@tabler/icons-vue";
import { saveSettings, settings } from "@/stores/settings";
import messageMarkdown from "@/components/messageMarkdown.vue";

type DocumentContent = { content: string; revision: string };
type DocumentState = DocumentContent & {
  savedContent: string;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  conflict: boolean;
  error: string;
};
type DocumentResponse = { code: number; data: DocumentContent; message?: string };

const props = defineProps<{ visible: boolean }>();
const maxLength = 20000;
const headers = { "x-toonflow-workspace": "1" };
const conflictMessage = msg`文件已被其他操作修改。当前草稿已保留，请先复制需要保留的内容，再重新加载最新版本。`;
const document = reactive<DocumentState>({
  content: "",
  revision: "",
  savedContent: "",
  loaded: false,
  loading: false,
  saving: false,
  conflict: false,
  error: "",
});
const memoryEnabled = computed(() => {
  const value = settings.value.personalization;
  return !value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).memoryEnabled !== false;
});
const savingMemorySetting = ref(false);
const memoryAction = ref<"view" | "delete" | "">("");
const memoryVisible = ref(false);
const memoryEditing = ref(false);
const memoryDocument = reactive<DocumentState>({
  content: "", revision: "", savedContent: "", loaded: false, loading: false, saving: false, conflict: false, error: "",
});

function isDirty(document: DocumentState) {
  return document.content !== document.savedContent;
}

function getDocumentError(document: DocumentState) {
  return document.error === conflictMessage.id ? translate(conflictMessage) : document.error;
}

function errorMessage(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || error.message
    : error instanceof Error
    ? error.message
    : "Operation failed, please retry";
}

async function loadDocument(document: DocumentState, name: "agents" | "memory", discardChanges = false) {
  if (document.loading || document.saving || (!discardChanges && isDirty(document))) return;
  const content = document.content;
  document.loading = true;
  document.error = "";
  try {
    const { data } = await axios.get<DocumentResponse>("/api/settings/personalization/get", { params: { document: name }, headers });
    if (data.code !== 200) throw new Error(data.message || "Load failed, please retry");
    if (document.content !== content) return;
    document.content = data.data.content;
    document.savedContent = data.data.content;
    document.revision = data.data.revision;
    document.loaded = true;
    document.conflict = false;
  } catch (error) {
    document.error = errorMessage(error);
  } finally {
    document.loading = false;
  }
}

async function reloadDocument(document: DocumentState, name: "agents" | "memory") {
  if (isDirty(document)) {
    try {
      await ElMessageBox.confirm("Reloading will discard unsaved changes in the current document and load the latest content.", "Reload", {
        confirmButtonText: "Discard changes and load",
        cancelButtonText: "Keep editing",
        type: "warning",
      });
    } catch {
      return;
    }
  }
  await loadDocument(document, name, true);
}

async function saveDocument(document: DocumentState, name: "agents" | "memory") {
  if (!document.loaded || document.loading || document.saving || document.conflict || !isDirty(document)) return;
  const content = document.content;
  if (content.length > maxLength) {
    ElMessage.error(`Content cannot exceed ${maxLength} characters`);
    return;
  }
  document.saving = true;
  document.error = "";
  try {
    const { data } = await axios.put<DocumentResponse>(
      "/api/settings/personalization/save",
      { document: name, content, revision: document.revision },
      { headers }
    );
    if (data.code === 409) {
      document.conflict = true;
      throw new Error(conflictMessage.id);
    }
    if (data.code !== 200) throw new Error(data.message || "Save failed, please retry");
    document.savedContent = data.data.content;
    document.revision = data.data.revision;
    if (document.content === content) document.content = data.data.content;
    ElMessage.success(`${name === "agents" ? "Toonflow instructions" : "Local memory"} saved`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) document.conflict = true;
    document.error = document.conflict ? conflictMessage.id : errorMessage(error);
    ElMessage.error(getDocumentError(document));
  } finally {
    document.saving = false;
  }
}

async function setMemoryEnabled(memoryEnabled: boolean) {
  if (savingMemorySetting.value) return;
  savingMemorySetting.value = true;
  try {
    await saveSettings((current) => {
      const value = current.personalization;
      return { personalization: { ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}), memoryEnabled } };
    });
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    savingMemorySetting.value = false;
  }
}

async function readMemory() {
  const { data } = await axios.get<DocumentResponse>("/api/settings/personalization/get", { params: { document: "memory" }, headers });
  if (data.code !== 200) throw new Error(data.message || "Failed to load local memory, please retry");
  return data.data;
}

async function viewMemory() {
  if (memoryAction.value || memoryDocument.loading || memoryDocument.saving) return;
  memoryAction.value = "view";
  try {
    await loadDocument(memoryDocument, "memory");
    if (memoryDocument.loaded) memoryVisible.value = true;
    else ElMessage.error(getDocumentError(memoryDocument));
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    memoryAction.value = "";
  }
}

async function saveMemory() {
  if (await saveDocument(memoryDocument, "memory")) memoryEditing.value = isDirty(memoryDocument);
}

async function deleteMemory() {
  if (memoryAction.value || memoryDocument.loading || memoryDocument.saving) return;
  memoryAction.value = "delete";
  try {
    const memory = await readMemory();
    if (!memory.content && !isDirty(memoryDocument)) {
      ElMessage.info("No local memory yet");
      return;
    }
    try {
      await ElMessageBox.confirm("This will delete the local memory shared across all workspaces and any unsaved memory changes. This cannot be undone. Toonflow instructions will be kept.", "Delete Local Memory", {
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        type: "warning",
      });
    } catch {
      return;
    }
    const { data } = await axios.put<DocumentResponse>(
      "/api/settings/personalization/save",
      { document: "memory", content: "", revision: memory.revision },
      { headers }
    );
    if (data.code === 409) throw new Error("Local memory has been updated and nothing was deleted. Please view it again and retry.");
    if (data.code !== 200) throw new Error(data.message || "Failed to delete local memory, please retry");
    Object.assign(memoryDocument, data.data, { savedContent: data.data.content, loaded: true, conflict: false, error: "" });
    memoryEditing.value = false;
    ElMessage.success("Local memory deleted");
  } catch (error) {
    ElMessage.error(
      axios.isAxiosError(error) && error.response?.status === 409 ? "Local memory has been updated and nothing was deleted. Please view it again and retry." : errorMessage(error)
    );
  } finally {
    memoryAction.value = "";
  }
}

function refreshDocument() {
  if (!props.visible) return;
  void loadDocument(document, "agents");
}

watch(() => props.visible, refreshDocument, { immediate: true });
onActivated(refreshDocument);
</script>

<style lang="scss" scoped>
.personalization {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 4px 8px;

  .settingSection {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 12px;

    h3,
    h4 {
      margin: 0;
      color: var(--el-text-color-primary);
      font-size: 14px;
      font-weight: 600;
    }

    .settingInfo {
      min-width: 0;

      .description {
        margin: 6px 0 0;
        color: var(--el-text-color-secondary);
        font-size: 12px;
        line-height: 1.6;
      }
    }

    .memoryOptions {
      display: flex;
      flex-direction: column;
      gap: 20px;

      .settingHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;

        > .el-button,
        > .el-switch {
          flex-shrink: 0;
        }
      }
    }

    .editorFooter {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .editorStatus {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }

      .editorActions {
        display: flex;
        gap: 8px;
        margin-left: auto;

        .el-button {
          margin-left: 0;
        }
      }
    }
  }
}

.memoryContent {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}

.memoryFooter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .editorStatus {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .editorActions {
    display: flex;
    gap: 8px;
    margin-left: auto;

    .el-button { margin-left: 0; }
  }
}
</style>
