<template>
  <div class="developerPanel">
    <div class="developer" :class="{ blurred: developerLocked }" :inert="developerLocked">
      <div class="developerRow">
        <div class="toolDescription">
          <h3>Developer Tools</h3>
          <p>Inspect the page structure, console, and network requests.</p>
        </div>
        <el-button type="primary" :icon="IconTerminal2" :loading="opening" :disabled="!isDesktop" @click="openDevTools">Open DevTools</el-button>
      </div>
      <el-text v-if="!isDesktop" type="info">In browser mode, open the developer tools from the browser menu.</el-text>
      <el-text v-if="requestError" type="danger" role="alert">{{ requestError }}</el-text>
      <div class="developerRow">
        <div class="toolDescription">
          <h3>First-Run Guide</h3>
          <p>Currently {{ hello.completed ? 'completed' : 'not completed' }}. After resetting, the guide page opens and your configured models are kept.</p>
        </div>
        <el-button :icon="IconRefresh" :loading="resettingHello" :disabled="importingStorage || writingStorage" @click="resetHello">Reset and Open Guide</el-button>
      </div>
      <div class="developerRow">
        <div class="toolDescription">
          <h3>Release Notes</h3>
          <p>Open the release notes dialog for the current version.</p>
        </div>
        <el-button :icon="IconFileText" :loading="openingUpdateBox" @click="openUpdateBox">View Release Notes</el-button>
      </div>
      <div class="developerRow">
        <div class="toolDescription">
          <h3>Provider Development Tools</h3>
          <p>Authorize access to a local provider file to debug generation APIs and media results.</p>
        </div>
        <el-button :icon="IconCode" @click="providerDebugVisible = true">Develop Provider</el-button>
      </div>
      <div class="developerRow">
        <div class="toolDescription">
          <h3>Agent System Prompt</h3>
          <p>Edit the Agent's base instructions. Changes take effect from the next message after saving.</p>
        </div>
        <el-button :icon="IconEdit" @click="systemPromptVisible = true">Edit Prompt</el-button>
      </div>
      <div class="developerRow">
        <div class="toolDescription">
          <h3>Custom Update Source</h3>
          <p>Enter the directory URL that hosts the update manifest and installers. After saving, you can select it on the About page.</p>
        </div>
        <div class="updateSourceEditor">
          <el-input v-model="customUpdateUrl" placeholder="https://example.com/desktopUpdates" aria-label="Custom update source directory URL" clearable :disabled="savingUpdateUrl" @keyup.enter="saveCustomUpdateUrl" />
          <el-button type="primary" :loading="savingUpdateUrl" @click="saveCustomUpdateUrl">Save</el-button>
        </div>
      </div>
      <el-text v-if="updateUrlError" type="danger" role="alert">{{ updateUrlError }}</el-text>
      <div class="pluginInstaller">
        <div class="installerHeader">
          <h3>Install Plugin Manually</h3>
          <el-select v-model="installType" class="typeSelect" :disabled="!!installing" aria-label="Plugin type to install">
            <el-option v-for="(item, type) in installTypes" :key="type" :label="item.label" :value="type" />
            <el-option label="Agent (not yet available)" value="agent" disabled />
          </el-select>
        </div>
        <div class="toolDescription">
          <p>{{ selectedInstaller.description }} Supports local files or direct file links. After installation, you can view it in the plugin market.</p>
        </div>
        <el-checkbox v-model="forceInstall" :disabled="!!installing">Force install (allow overwriting the same version or downgrading)</el-checkbox>
        <input ref="fileInput" class="fileInput" type="file" :accept="selectedInstaller.accept" @change="installFile" />
        <el-button :icon="IconFileUpload" :loading="installing === 'file'" :disabled="!!installing" @click="fileInput?.click()">Select local {{ selectedInstaller.label }} file</el-button>
        <div class="urlInstaller">
          <el-input v-model="pluginUrl" :disabled="!!installing" :placeholder="`https://example.com/${selectedInstaller.example}`" :aria-label="`${selectedInstaller.label} file URL`" clearable @keyup.enter="installUrl" />
          <el-button type="primary" :icon="IconDownload" :loading="installing === 'url'" :disabled="!!installing || !pluginUrl.trim()" @click="installUrl">Install from URL</el-button>
        </div>
        <el-text v-if="installError" type="danger" role="alert">{{ installError }}</el-text>
        <el-text v-else-if="installedName" type="success" role="status">{{ installedName }} installed</el-text>
      </div>
      <div class="storageManager">
        <div class="developerRow">
          <div class="toolDescription">
            <h3>Persistent Browser Cache</h3>
            <p>Manage localStorage for this site. Changes take effect after reloading. To reset the first-run guide, use the button above. Importing overwrites items with the same name and keeps other items.</p>
          </div>
          <div class="storageToolbar">
            <input ref="storageFileInput" type="file" accept=".json,application/json" hidden @change="importStorage" />
            <el-button :icon="IconFileUpload" :loading="importingStorage" :disabled="storageBusy" @click="storageFileInput?.click()">Import</el-button>
            <el-button :icon="IconDownload" :disabled="storageBusy" @click="exportStorage">Export</el-button>
            <el-button :icon="IconRefresh" :disabled="storageBusy" @click="loadStorage">Refresh List</el-button>
          </div>
        </div>
        <el-text v-if="storageError" type="danger" role="alert">{{ storageError }}</el-text>
        <el-text v-else-if="storageMessage" type="success" role="status">{{ translate(storageMessage) }}</el-text>
        <div v-for="entry in storageEntries" :key="entry.key" class="storageItem">
          <div class="storageHeader">
            <span class="storageKey">{{ entry.key || '(empty key)' }}</span>
            <div class="storageActions">
              <el-button :icon="IconEdit" text :disabled="storageBusy" :aria-label="`Edit ${entry.key}`" @click="editStorage(entry)">Edit</el-button>
              <el-popconfirm title="Delete this cache entry?" confirmButtonText="Delete" cancelButtonText="Cancel" @confirm="writeStorage(entry, null)">
                <template #reference>
                  <el-button :icon="IconTrash" type="danger" text :disabled="storageBusy" :aria-label="`Delete ${entry.key}`">Delete</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
          <template v-if="editingKey === entry.key">
            <el-input v-model="storageValue" type="textarea" :rows="5" :disabled="storageBusy" :aria-label="`Value of ${entry.key}`" />
            <div class="storageActions">
              <el-button :disabled="storageBusy" @click="editingKey = null">Cancel</el-button>
              <el-button type="primary" :loading="writingStorage" :disabled="storageBusy" @click="writeStorage(entry, storageValue)">Save</el-button>
            </div>
          </template>
          <div v-else class="storageValue">{{ entry.value }}</div>
        </div>
      </div>
    </div>
    <providerDebugDialog v-if="providerDebugVisible" v-model="providerDebugVisible" />
    <systemPromptDialog v-if="systemPromptVisible" v-model="systemPromptVisible" />
    <updateBox v-if="updateBoxVisible" v-model="updateBoxVisible" :version="updateBoxBuild.version" :buildCode="updateBoxBuild.hash || translate('未提供')" />
    <div v-if="developerLocked" class="developerConfirm">
      <icon-code :size="28" aria-hidden="true" />
      <h3>Confirm Entering Developer Options</h3>
      <p>This feature is for development and debugging only. Regular users should not enable it. Installing unknown nodes or modifying or clearing the cache may cause the program to malfunction or lose data. Please confirm that you understand the risks before continuing. Your choice will be remembered.</p>
      <el-button type="primary" @click="confirmDeveloper">Confirm and Continue</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { locale, msg, translate, type MessageDescriptor } from "@toonflow/i18n/vue";
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useDeveloperStore } from "@/stores/developer";
import { useHelloStore } from "@/stores/hello";
import { saveSettings, settings } from "@/stores/settings";
import { desktopUpdateSnapshot } from "@/stores/desktopUpdate";
import type { updateSnapshot } from "@toonflow/server/desktop";
import saveFile from "@/lib/saveFile";
import { installPluginFile } from "../../installPluginFile";
import { ElMessage } from "element-plus";
import axios from "axios";
import { IconCode, IconTerminal2, IconFileUpload, IconFileText, IconDownload, IconRefresh, IconEdit, IconTrash } from "@tabler/icons-vue";

const developerStore = useDeveloperStore();
const hello = useHelloStore();
const router = useRouter();
const resettingHello = ref(false);
const providerDebugDialog = defineAsyncComponent(() => import("./providerDebugDialog.vue"));
const providerDebugVisible = ref(false);
const systemPromptDialog = defineAsyncComponent(() => import("./systemPromptDialog.vue"));
const systemPromptVisible = ref(false);
const updateBox = defineAsyncComponent(() => import("@/components/updateBox.vue"));
const updateBoxVisible = ref(false);
const openingUpdateBox = ref(false);
const updateBoxBuild = ref({ version: import.meta.env.appVersion ?? "", hash: import.meta.env.DEV ? "dev" : "" });
const developerLocked = computed(() => !developerStore.developerConfirmed);
const customUpdateUrl = ref(typeof settings.value.desktopUpdateCustomUrl === "string" ? settings.value.desktopUpdateCustomUrl : "");
const savingUpdateUrl = ref(false);
const updateUrlError = ref("");

async function openUpdateBox() {
  if (openingUpdateBox.value) return;
  openingUpdateBox.value = true;
  try {
    if (isDesktop) {
      const snapshot = desktopUpdateSnapshot.value ?? (await axios.get<{ data: updateSnapshot }>("/api/desktop/update", { timeout: 10000 })).data.data;
      if (!snapshot?.version || !snapshot.hash) throw new Error("Failed to read the current version and build code. Please try again.");
      updateBoxBuild.value = { version: snapshot.version, hash: snapshot.hash };
    }
    updateBoxVisible.value = true;
  } catch (error) {
    ElMessage.error(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "Failed to read version information");
  } finally {
    openingUpdateBox.value = false;
  }
}

async function saveCustomUpdateUrl() {
  if (savingUpdateUrl.value) return;
  const url = customUpdateUrl.value.trim();
  updateUrlError.value = "";
  try {
    if (url && !URL.canParse(url)) throw new Error("Please enter a valid HTTP(S) directory URL");
    if (url) {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || url.length > 2048)
        throw new Error("Please enter an HTTP(S) directory URL without credentials, query parameters, or fragments");
    }
    savingUpdateUrl.value = true;
    await saveSettings(current => ({
      desktopUpdateCustomUrl: url,
      ...(url || current.desktopUpdateSource !== "custom" ? {} : { desktopUpdateSource: "official" }),
    }));
    customUpdateUrl.value = url;
    ElMessage.success("Custom update source saved");
  } catch (error) {
    updateUrlError.value = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "Failed to save update source";
  } finally {
    savingUpdateUrl.value = false;
  }
}

async function resetHello() {
  if (storageBusy.value) return;
  resettingHello.value = true;
  try {
    await hello.reset();
    loadStorage();
    await router.replace("/hello");
  } catch {
    ElMessage.error("Failed to reset the guide. Please try again");
  } finally {
    resettingHello.value = false;
  }
}

function confirmDeveloper() {
  developerStore.developerConfirmed = true;
  loadStorage();
}

const installTypes = {
  node: { get label() { return translate("节点"); }, accept: ".umd.js", example: "imageNode.umd.js", get description() { return translate("选择脚手架打包的 .umd.js 文件。"); } },
  ext: { get label() { return translate("文件扩展"); }, accept: ".umd.js", example: "ext-image.umd.js", get description() { return translate("选择扩展脚手架打包的 ext-*.umd.js 文件。"); } },
  skill: { get label() { return translate("技能"); }, accept: ".zip,.md,.tar,.tar.gz,.tgz", example: "skill.zip", get description() { return translate("支持包含技能与资源的 .zip 包、SKILL.md，以及 .tar、.tar.gz、.tgz 包。"); } },
  tool: { get label() { return translate("工具"); }, accept: ".tool.js", example: "mediaGeneration.tool.js", get description() { return translate("选择脚手架打包的 .tool.js 文件。"); } },
};
const installType = ref<keyof typeof installTypes>("node");
const selectedInstaller = computed(() => installTypes[installType.value]);
const fileInput = ref<HTMLInputElement>();
const pluginUrl = ref("");
const forceInstall = ref(false);
const installing = ref<"file" | "url" | "">("");
const installError = ref("");
const installedName = ref("");
watch(installType, () => {
  pluginUrl.value = "";
  installError.value = "";
  installedName.value = "";
});
const storageEntries = ref<{ key: string; value: string }[]>([]);
const storageError = ref("");
const editingKey = ref<string | null>(null);
const storageValue = ref("");
const storageFileInput = ref<HTMLInputElement>();
const importingStorage = ref(false);
const writingStorage = ref(false);
const storageBusy = computed(() => importingStorage.value || writingStorage.value || resettingHello.value);
const storageMessage = ref<string | MessageDescriptor>("");

function readStorage() {
  return Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key) ?? ""]));
}

function saveStorage(entries: [string, string | null][]) {
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, value] of entries) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } catch (error) {
    // ACT: localStorage has no transactions; on a write failure, restore the entries changed in this call.
    for (const [key, value] of previous.reverse()) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
}

async function importStorage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || storageBusy.value) return;
  importingStorage.value = true;
  storageError.value = "";
  storageMessage.value = "";
  try {
    const data: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.values(data).some(value => typeof value !== "string")) {
      throw new Error("Please select a JSON object whose keys and values are all strings, for example {\"key\":\"value\"}.");
    }
    const entries = Object.entries(data) as [string, string][];
    saveStorage(entries);
    loadStorage();
    storageMessage.value = msg`已导入 ${entries.length} 项，重新加载页面后生效。`;
  } catch (err) {
    storageError.value = err instanceof Error ? err.message : "Failed to import cache";
  } finally {
    importingStorage.value = false;
  }
}

async function exportStorage() {
  storageError.value = "";
  storageMessage.value = "";
  try {
    const data = readStorage();
    await saveFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "toonflowLocalStorage.json");
  } catch (err) {
    storageError.value = err instanceof Error ? err.message : "Failed to export cache";
  }
}

function loadStorage() {
  storageError.value = "";
  storageMessage.value = "";
  try {
    storageEntries.value = Object.entries(readStorage()).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => ({ key, value }));
    editingKey.value = null;
  } catch (err) {
    storageError.value = err instanceof Error ? err.message : "Failed to read cache";
  }
}

function editStorage(entry: { key: string; value: string }) {
  editingKey.value = entry.key;
  storageValue.value = entry.value;
}

function writeStorage(entry: { key: string; value: string }, value: string | null) {
  if (storageBusy.value) return;
  writingStorage.value = true;
  storageError.value = "";
  storageMessage.value = "";
  try {
    if (readStorage()[entry.key] !== entry.value) throw new Error("This entry has changed. Refresh the list and try again.");
    saveStorage([[entry.key, value]]);
    if (editingKey.value === entry.key) editingKey.value = null;
    loadStorage();
    storageMessage.value = msg`已保存，重新加载页面后生效。`;
  } catch (err) {
    storageError.value = err instanceof Error ? err.message : "Failed to update cache";
  } finally {
    writingStorage.value = false;
  }
}

loadStorage();

async function installFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || installing.value) return;
  await installPlugin("file", file);
}

async function installUrl() {
  if (!pluginUrl.value.trim() || installing.value) return;
  await installPlugin("url");
}

async function installPlugin(sourceType: "file" | "url", file?: File) {
  const type = installType.value;
  installing.value = sourceType;
  installError.value = "";
  installedName.value = "";
  try {
    if (file) {
      installedName.value = await installPluginFile(type, file, forceInstall.value);
    } else {
      const { data } = await axios.post(`/api/${type === "ext" ? "ext" : `${type}s`}/install`, { url: pluginUrl.value.trim(), force: forceInstall.value }, { headers: { "x-toonflow-workspace": "1" } });
      if (data.code !== 200) throw new Error(data.message || "Installation failed");
      installedName.value = data.data.name;
      window.dispatchEvent(new CustomEvent("toonflow:plugin-installed", { detail: { type, name: data.data.name } }));
      if (type === "ext") window.dispatchEvent(new CustomEvent("toonflow:ext-updated", { detail: { name: data.data.name } }));
    }
  } catch (err) {
    installError.value = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data.message || "Installation failed. Check your network and try again" : err instanceof Error ? err.message : "Installation failed";
  } finally {
    installing.value = "";
  }
}

const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "1";
const opening = ref(false);
const requestError = ref("");

async function openDevTools() {
  if (!isDesktop || opening.value) return;
  opening.value = true;
  requestError.value = "";
  try {
    const response = await fetch("/api/desktop/devtools", { method: "POST", headers: { "x-toonflow-desktop": "1", "Accept-Language": locale.value } });
    if (!response.ok) throw new Error((await response.json()).message || "Failed to open developer tools. Please try again.");
  } catch (error) {
    requestError.value = error instanceof Error ? error.message : "Failed to open developer tools. Please try again.";
  } finally {
    opening.value = false;
  }
}
</script>

<style lang="scss" scoped>
.developerPanel {
  position: relative;
  height: 100%;
  overflow: hidden;

  .developer {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    &.blurred { filter: blur(6px); user-select: none; pointer-events: none; }
    display: flex;
    flex-direction: column;
    gap: 16px;

    .toolDescription {
      h3 { margin: 0 0 8px; font-size: 14px; color: var(--el-text-color-primary); }
      p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--el-text-color-secondary); }
    }

    .pluginInstaller {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      margin-top: 16px;

      .installerHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        width: 100%;

        h3 { margin: 0; font-size: 14px; color: var(--el-text-color-primary); }
        .typeSelect { width: 160px; }
      }

      .fileInput { display: none; }
      .urlInstaller {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        gap: 12px;

        .el-input { flex: 1; min-width: 200px; }
      }
    }

    .developerRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;

      .updateSourceEditor {
        display: flex;
        flex: 1;
        flex-wrap: wrap;
        gap: 8px;
        min-width: min(100%, 280px);

        .el-input { flex: 1; min-width: 200px; }
      }
    }

    .storageManager {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
      min-width: 0;

      .storageToolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .el-button { margin-left: 0; }
      }

      .storageItem {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        border-radius: var(--el-border-radius-base);
        background: var(--el-fill-color-light);

        .storageHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;

          .storageKey { overflow-wrap: anywhere; font-size: 13px; font-weight: 500; }
        }

        .storageActions { display: flex; justify-content: flex-end; flex-shrink: 0; }
        .storageValue { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow: auto; font-size: 13px; color: var(--el-text-color-secondary); }
      }
    }
  }

  .developerConfirm {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    overflow-y: auto;
    text-align: center;
    background: color-mix(in srgb, var(--el-bg-color) 75%, transparent);

    h3 { margin: 0; font-size: 16px; }
    p { margin: 0; max-width: 320px; line-height: 1.6; color: var(--el-text-color-secondary); }
  }
}
</style>
