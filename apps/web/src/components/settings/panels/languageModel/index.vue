<template>
  <div class="providerList">
    <div class="itemList">
      <el-card v-for="item in sortedProviders" :key="item.id" class="providerItem" shadow="never">
        <div class="providerHeader">
          <div v-if="isTfRouterProvider(item)" class="providerMark" aria-hidden="true">
            <img class="providerLogo" :src="logoUrl" alt="" />
          </div>
          <div class="providerInfo">
            <div class="providerHeading">
              <el-text class="providerName" tag="strong">{{ item.label }}</el-text>
              <el-tag v-if="isTfRouterProvider(item)" size="small">Official</el-tag>
            </div>
            <el-text class="providerId" size="small" type="info" :title="item.id">{{ item.id }}</el-text>
          </div>
        </div>
        <tfAccount v-if="isTfRouterProvider(item)" :apiKey="typeof item.apiKey === 'string' ? item.apiKey : ''" :visible="visible" :saveApiKey="(key) => saveProviderApiKey(item.id, key)" />
        <div class="providerFooter">
          <div class="providerMeta">
            <el-tag v-if="getProviderVersion(item)" size="small" type="info" effect="plain">v{{ getProviderVersion(item) }}</el-tag>
            <el-text size="small" type="info">{{ item.models.length }} models</el-text>
          </div>
          <el-space class="itemActions" wrap>
            <el-button v-if="isTfRouterProvider(item) && item.apiKey?.trim() && !item.models.length" text :icon="IconRefresh" :loading="fetchingId === item.id" :disabled="!!deletingId || !!fetchingId" @click="fetchProviderModels(item)">Fetch Models</el-button>
            <el-button text :icon="IconEdit" :disabled="!!deletingId" @click="openCustomProvider(item)">Edit</el-button>
            <el-popconfirm title="Delete this provider and its models?" confirmButtonText="Delete" cancelButtonText="Cancel" @confirm="deleteProvider(item.id)">
              <template #reference><el-button text type="danger" :icon="IconTrash" :loading="deletingId === item.id" :disabled="!!deletingId">Delete</el-button></template>
            </el-popconfirm>
          </el-space>
        </div>
      </el-card>
    </div>
    <div class="providerActions">
      <el-button class="addButton" :icon="IconPlus" @click="openProvider">Add Provider</el-button>
      <el-button class="addButton" :icon="IconSettings" @click="openCustomProvider()">Add Custom Provider</el-button>
    </div>
    <component :is="addProviderDialog" v-model="providerDialogVisible" />
    <component :is="addCustomProviderDialog" v-model="customProviderDialogVisible" :provider="editingProvider" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, type Component } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import { customProviders, saveSettings, type CustomProvider } from "@/stores/settings";
import { IconPlus, IconSettings, IconEdit, IconTrash, IconRefresh } from "@tabler/icons-vue";
import { languageProviders } from "@toonflow/providers";
import logoUrl from "@toonflow/assets/logo.svg";
import tfAccount from "../../tfAccount.vue";
import { isTfRouterProvider } from "@/lib/tf";

const { visible = true } = defineProps<{ visible?: boolean }>();
const addProviderDialog = shallowRef<Component>();
const addCustomProviderDialog = shallowRef<Component>();
const providerDialogVisible = ref(false);
const customProviderDialogVisible = ref(false);
const editingProvider = ref<CustomProvider>();
const deletingId = ref("");
const fetchingId = ref("");
const sortedProviders = computed(() => [...customProviders.value].sort((a, b) => Number(isTfRouterProvider(b)) - Number(isTfRouterProvider(a))));

function getProviderVersion(provider: CustomProvider) {
  const version = languageProviders.find(item => item.id.toLowerCase() === provider.id.toLowerCase())?.version ?? provider.version;
  return typeof version === "string" ? version.trim() : "";
}

function openProvider() {
  addProviderDialog.value ??= defineAsyncComponent(() => import("./addProviderDialog.vue"));
  providerDialogVisible.value = true;
}

function openCustomProvider(provider?: CustomProvider) {
  addCustomProviderDialog.value ??= defineAsyncComponent(() => import("./addCustomProviderDialog.vue"));
  editingProvider.value = provider;
  customProviderDialogVisible.value = true;
}

async function deleteProvider(id: string) {
  if (deletingId.value) return;
  deletingId.value = id;
  try {
    await saveSettings(settings => {
      const current = settings.customProviders;
      if (!Array.isArray(current)) throw new Error("Invalid configuration format");
      return { customProviders: current.filter(item => item?.id !== id) };
    });
  } catch { ElMessage.error("Failed to delete. Please try again"); }
  finally { deletingId.value = ""; }
}

async function saveProviderApiKey(id: string, key: string) {
  const provider = customProviders.value.find(item => item.id === id);
  if (!provider) throw new Error("The provider no longer exists");
  const { apiUrl, protocol, apiKey } = provider;
  await saveSettings(settings => {
    const current = settings.customProviders;
    if (!Array.isArray(current)) throw new Error("Invalid configuration format");
    const latest = current.find(item => item?.id === id);
    if (!latest) throw new Error("The provider no longer exists");
    if (latest.apiUrl !== apiUrl || latest.protocol !== protocol || latest.apiKey !== apiKey) {
      throw new Error("The provider configuration has changed. Please try again");
    }
    return { customProviders: current.map(item => item?.id === id ? { ...item, apiKey: key } : item) };
  });
}

async function fetchProviderModels(provider: CustomProvider) {
  if (fetchingId.value) return;
  const { id, apiUrl, protocol, apiKey } = provider;
  fetchingId.value = id;
  try {
    const { data } = await axios.post("/api/providers/models", { apiUrl, protocol, apiKey }, { timeout: 35000 });
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Failed to fetch the model list");
    if (!data.data.length) throw new Error("No available models were found. Check your API Key and try again");
    await saveSettings(settings => {
      const current = settings.customProviders;
      if (!Array.isArray(current)) throw new Error("Invalid configuration format");
      const latest = current.find(item => item?.id === id);
      if (!latest) throw new Error("The provider no longer exists");
      if (latest.apiUrl !== apiUrl || latest.protocol !== protocol || latest.apiKey !== apiKey) {
        throw new Error("The provider configuration has changed. Please try again");
      }
      return { customProviders: current.map(item => item?.id === id ? { ...item, models: data.data } : item) };
    });
  } catch (error) {
    ElMessage.error(axios.isAxiosError(error) ? error.response?.data?.message || "Failed to fetch the model list. Please try again" : error instanceof Error ? error.message : "Failed to fetch the model list. Please try again");
  }
  finally { fetchingId.value = ""; }
}
</script>

<style lang="scss" scoped src="../../providerList.scss"></style>
