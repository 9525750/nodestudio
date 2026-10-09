<template>
  <el-dialog
    v-model="visible"
    :title="provider ? 'Edit Provider' : 'Add Custom Provider'"
    width="min(760px, 94vw)"
    alignCenter
    appendToBody
    destroyOnClose
    :closeOnClickModal="false"
    :closeOnPressEscape="!saving"
    :showClose="!saving"
    @closed="resetForm">
    <el-scrollbar maxHeight="65vh">
      <el-form ref="providerForm" :model="form" :rules="rules" labelPosition="top" :disabled="saving" class="customProviderForm">
        <div class="formGrid">
          <el-form-item label="Provider ID" prop="id"><el-input v-model="form.id" placeholder="e.g. myProvider" /></el-form-item>
          <el-form-item label="Display Name" prop="label"><el-input v-model="form.label" placeholder="Display name of the provider" /></el-form-item>
          <el-form-item label="API URL" prop="apiUrl"><el-input v-model="form.apiUrl" dir="ltr" placeholder="https://api.example.com/v1" /></el-form-item>
          <el-form-item label="API Protocol" prop="protocol">
            <el-select v-model="form.protocol" aria-label="API protocol">
              <el-option v-for="protocol in protocols" :key="protocol" :label="protocol" :value="protocol" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="API Key" prop="apiKey">
          <el-input v-model="form.apiKey" type="password" dir="ltr" showPassword autocomplete="off" placeholder="Leave empty for local services without authentication" />
        </el-form-item>
        <div class="modelHeader">
          <el-text tag="strong">Model List</el-text>
          <el-button :icon="IconDownload" :loading="fetching" @click="fetchModels()">Fetch Model List</el-button>
        </div>
        <div class="modelList">
          <div v-for="item in models" :key="item.key" class="modelItem">
            <div class="modelRow">
              <el-input v-model="item.id" placeholder="Model ID" aria-label="Model ID" />
              <el-input v-model="item.label" placeholder="Display name" aria-label="Model display name" />
              <el-button
                text
                :icon="expandedModels.has(item.key) ? IconChevronUp : IconChevronDown"
                :aria-expanded="expandedModels.has(item.key)"
                aria-label="Expand token settings"
                @click="expandedModels.has(item.key) ? expandedModels.delete(item.key) : expandedModels.add(item.key)" />
              <el-button
                text
                type="danger"
                :icon="IconTrash"
                aria-label="Delete model"
                @click="models = models.filter((model) => model.key !== item.key)" />
            </div>
            <div v-if="expandedModels.has(item.key)" class="formGrid tokenSettings">
              <el-form-item label="Context Window">
                <el-input-number
                  v-model="item.contextWindow"
                  :min="1"
                  :max="Number.MAX_SAFE_INTEGER"
                  :precision="0"
                  controlsPosition="right"
                  placeholder="Not set"
                  aria-label="Context window" />
              </el-form-item>
              <el-form-item label="Max Output Tokens">
                <el-input-number
                  v-model="item.maxOutputTokens"
                  :min="1"
                  :max="Number.MAX_SAFE_INTEGER"
                  :precision="0"
                  controlsPosition="right"
                  placeholder="Not set"
                  aria-label="Max output tokens" />
              </el-form-item>
            </div>
          </div>
        </div>
        <el-button class="manualAdd" :icon="IconPlus" @click="addManualModel">Add Model Manually</el-button>
        <el-alert v-if="formError" :title="formError" type="error" :closable="false" showIcon />
      </el-form>
    </el-scrollbar>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Cancel</el-button>
      <el-button type="primary" :loading="saving" :disabled="fetching" @click="addProvider">
        {{ provider ? "Save Changes" : "Add Provider" }}
      </el-button>
    </template>
  </el-dialog>
  <el-dialog v-model="resultsVisible" title="Select Models to Add" width="min(680px, 92vw)" alignCenter appendToBody destroyOnClose>
    <el-input v-model="modelSearch" clearable :prefixIcon="IconSearch" placeholder="Search by model ID or display name" aria-label="Search models" />
    <div class="modelResults">
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            :columns="resultColumns"
            :data="filteredModels"
            :width="width"
            :height="height"
            :rowHeight="38"
            :headerHeight="36"
            rowKey="id"
            fixed />
        </template>
      </el-auto-resizer>
    </div>
    <el-text type="info">{{ filteredModels.length }} results, {{ selectedIds.size }} selected</el-text>
    <template #footer>
      <el-button @click="resultsVisible = false">Cancel</el-button>
      <el-button type="primary" :disabled="!selectedIds.size" @click="addSelectedModels">Add Selected Models ({{ selectedIds.size }})</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, reactive, ref, shallowRef, watch } from "vue";
import axios from "axios";
import { ElCheckbox, type FormInstance, type FormRules, type Column } from "element-plus";
import {
  IconPlus,
  IconDownload,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
} from "@tabler/icons-vue";
import { saveSettings, type CustomProvider, type CustomProviderModel } from "@/stores/settings";
import { languageProviders } from "@toonflow/providers";
import { isTfRouterProvider } from "@/lib/tf";

const props = defineProps<{ provider?: CustomProvider }>();
const visible = defineModel<boolean>({ default: false });
const providerForm = ref<FormInstance>();
const form = reactive({ id: "", label: "", apiUrl: "", protocol: "openai-completions", apiKey: "" });
const models = ref<(CustomProviderModel & { key: string })[]>([]);
const expandedModels = ref(new Set<string>());
const fetchedModels = shallowRef<CustomProviderModel[]>([]);
const selectedIds = ref(new Set<string>());
const modelSearch = ref("");
const saving = ref(false);
const protocols = ["openai-completions", "openai-responses", "anthropic-messages"];
const addedIds = computed(() => new Set(models.value.map((item) => item.id.trim())));
const filteredModels = computed(() => {
  const query = modelSearch.value.trim().toLowerCase();
  return query ? fetchedModels.value.filter((item) => `${item.id} ${item.label}`.toLowerCase().includes(query)) : fetchedModels.value;
});
const resultColumns = computed<Column[]>(() => [
  {
    key: "selection",
    width: 42,
    cellRenderer: ({ rowData }) =>
      h(ElCheckbox, {
        modelValue: selectedIds.value.has(rowData.id),
        disabled: addedIds.value.has(rowData.id),
        ariaLabel: `Select ${rowData.id}`,
        onChange: (value: boolean | string | number) => {
          if (value) selectedIds.value.add(rowData.id);
          else selectedIds.value.delete(rowData.id);
        },
      }),
  },
  { key: "id", dataKey: "id", title: "Model ID", width: 240, flexGrow: 1 },
  { key: "label", dataKey: "label", title: "Display Name", width: 200, flexGrow: 1 },
]);
const resultsVisible = ref(false);
const fetching = ref(false);
const formError = ref("");
let request: AbortController | undefined;
const rules: FormRules = {
  id: [
    { required: true, message: "Please enter a Provider ID", trigger: "blur" },
    { pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, message: "Only letters, numbers, dots, underscores, and hyphens are allowed", trigger: "blur" },
  ],
  label: [{ required: true, whitespace: true, message: "Please enter a display name", trigger: "blur" }],
  apiUrl: [
    {
      validator: (_rule, value, callback) => {
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
          callback();
        } catch {
          callback(new Error("Please enter a valid HTTP API base URL without query parameters"));
        }
      },
      trigger: "blur",
    },
  ],
};

watch(visible, (value) => {
  if (value) {
    resetForm();
    if (props.provider) {
      const { models: providerModels, ...config } = props.provider;
      Object.assign(form, config);
      models.value = providerModels.map((item) => ({ ...item, key: crypto.randomUUID() }));
    }
  } else {
    request?.abort();
    resultsVisible.value = false;
  }
}, { immediate: true });
onBeforeUnmount(() => request?.abort());
watch([() => form.id, () => form.apiUrl, () => form.protocol, () => form.apiKey], () => request?.abort());

function resetForm() {
  Object.assign(form, { id: "", label: "", apiUrl: "", protocol: "openai-completions", apiKey: "" });
  models.value = [];
  expandedModels.value = new Set();
  fetchedModels.value = [];
  selectedIds.value = new Set();
  modelSearch.value = "";
  formError.value = "";
}

async function fetchModels() {
  if (fetching.value || !(await providerForm.value?.validateField("apiUrl").catch(() => false))) return;
  fetching.value = true;
  formError.value = "";
  const controller = new AbortController();
  request = controller;
  try {
    const { data } = await axios.post(
      "/api/providers/models",
      { apiUrl: form.apiUrl.trim(), protocol: form.protocol, apiKey: form.apiKey.trim() },
      { signal: controller.signal, timeout: 35000 }
    );
    if (controller.signal.aborted) return;
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Failed to fetch the model list");
    if (isTfRouterProvider(form)) {
      if (!data.data.length) throw new Error("No available models were found. Check your API Key and try again");
      models.value = data.data.map((item: CustomProviderModel) => ({ ...item, key: crypto.randomUUID() }));
      return;
    }
    fetchedModels.value = data.data;
    selectedIds.value = new Set();
    modelSearch.value = "";
    resultsVisible.value = true;
  } catch (error) {
    if (!controller.signal.aborted) {
      formError.value = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to fetch the model list. Check the connection settings"
        : error instanceof Error
        ? error.message
        : "Failed to fetch the model list";
    }
  } finally {
    fetching.value = false;
  }
}

function addSelectedModels() {
  const added = new Set(addedIds.value);
  for (const item of fetchedModels.value) {
    if (selectedIds.value.has(item.id) && !added.has(item.id)) {
      models.value.push({ ...item, key: crypto.randomUUID() });
      added.add(item.id);
    }
  }
  resultsVisible.value = false;
}

function addManualModel() {
  const key = crypto.randomUUID();
  models.value.push({ key, id: "", label: "" });
}

async function addProvider() {
  if (fetching.value) return;
  formError.value = "";
  if (saving.value || !(await providerForm.value?.validate().catch(() => false))) return;
  const providerId = props.provider?.id;
  const ids = models.value.map((item) => item.id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    formError.value = "Model ID cannot be empty or duplicated";
    return;
  }
  if (
    models.value.some((item) =>
      [item.contextWindow, item.maxOutputTokens].some((value) => value != null && (!Number.isSafeInteger(value) || value < 1))
    )
  ) {
    formError.value = "Token limits must be positive integers or left empty";
    return;
  }
  saving.value = true;
  try {
    const updatedProvider = {
      ...form,
      label: form.label.trim(),
      apiUrl: form.apiUrl.trim(),
      apiKey: form.apiKey.trim(),
      models: models.value.map(({ key, ...item }) => ({
        ...item,
        id: item.id.trim(),
        label: item.label.trim() || item.id.trim(),
        contextWindow: item.contextWindow ?? undefined,
        maxOutputTokens: item.maxOutputTokens ?? undefined,
      })),
    };
    await saveSettings(settings => {
      const existing = settings.customProviders;
      if (existing !== undefined && !Array.isArray(existing)) throw new Error("The saved provider configuration has an invalid format");
      if (languageProviders.some(item => item.id !== providerId && item.id.toLowerCase() === updatedProvider.id.toLowerCase())
        || existing?.some(item => typeof item?.id === "string" && item.id !== providerId && item.id.toLowerCase() === updatedProvider.id.toLowerCase())) {
        throw new Error("Provider ID already exists");
      }
      if (providerId && !existing?.some(item => item.id === providerId)) throw new Error("The provider no longer exists");
      return { customProviders: providerId
        ? existing!.map(item => item.id === providerId ? updatedProvider : item)
        : [...(existing ?? []), updatedProvider] };
    });
    visible.value = false;
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Failed to save. Please try again; what you entered has been kept";
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.customProviderForm {
  padding-right: 12px;

  .formGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;

    .el-input-number {
      width: 100%;
    }
  }

  .modelHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0 16px;
  }

  .modelList {
    .modelItem {
      padding: 8px 0;
      border-bottom: 1px solid var(--el-border-color-lighter);

      .modelRow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px 28px;
        align-items: center;
        gap: 8px;

        .el-button {
          margin: 0;
          padding: 4px;
        }
      }

      .tokenSettings {
        padding-top: 12px;

        .el-form-item {
          margin-bottom: 4px;
        }
      }
    }
  }

  .manualAdd {
    width: 100%;
    margin: 16px 0;
  }

  @media (max-width: 560px) {
    .formGrid {
      grid-template-columns: 1fr;
    }
  }
}
.modelResults {
  height: min(420px, 55dvh);
  margin: 12px 0;
}
</style>
