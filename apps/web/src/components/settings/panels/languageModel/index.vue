<template>
  <div class="providerList">
    <div class="itemList">
      <el-card v-for="item in customProviders" :key="item.id" class="providerItem" shadow="never">
        <div class="providerHeader">
          <div class="providerInfo">
            <div class="providerHeading">
              <el-text class="providerName" tag="strong">{{ item.label }}</el-text>
            </div>
            <el-text class="providerId" size="small" type="info" :title="item.id">{{ item.id }}</el-text>
          </div>
        </div>
        <div class="providerFooter">
          <div class="providerMeta">
            <el-text size="small" type="info">{{ item.models.length }} models</el-text>
          </div>
          <el-space class="itemActions" wrap>
            <el-button text :icon="IconEdit" :disabled="!!deletingId" @click="openCustomProvider(item)">Edit</el-button>
            <el-popconfirm title="Delete this provider and its models?" confirmButtonText="Delete" cancelButtonText="Cancel" @confirm="deleteProvider(item.id)">
              <template #reference><el-button text type="danger" :icon="IconTrash" :loading="deletingId === item.id" :disabled="!!deletingId">Delete</el-button></template>
            </el-popconfirm>
          </el-space>
        </div>
      </el-card>
    </div>
    <div class="providerActions">
      <el-button class="addButton" :icon="IconPlus" @click="openCustomProvider()">Add Custom Provider</el-button>
    </div>
    <component :is="addCustomProviderDialog" v-model="customProviderDialogVisible" :provider="editingProvider" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, shallowRef, type Component } from "vue";
import { ElMessage } from "element-plus";
import { customProviders, saveSettings, type CustomProvider } from "@/stores/settings";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-vue";

const { visible = true } = defineProps<{ visible?: boolean }>();
const addCustomProviderDialog = shallowRef<Component>();
const customProviderDialogVisible = ref(false);
const editingProvider = ref<CustomProvider>();
const deletingId = ref("");

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
</script>

<style lang="scss" scoped src="../../providerList.scss"></style>
