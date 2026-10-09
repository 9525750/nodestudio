<template>
  <el-dialog v-model="visible" title="Default Open With" width="min(660px, calc(100vw - 32px))" alignCenter appendToBody>
    <div class="extensionAssociations" v-loading="loading">
      <p>Choose the default extension for each file type. After clearing, you will be asked again how to open the file when multiple extensions are available.</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table :data="rows" maxHeight="420" emptyText="No installed file extensions or default associations">
        <el-table-column label="File type" width="140">
          <template #default="{ row }">{{ row.suffix === 'canvasNode' ? 'Canvas node' : `.${row.suffix}` }}</template>
        </el-table-column>
        <el-table-column label="Default extension">
          <template #default="{ row }">
            <el-select :modelValue="extensionAssociations[row.suffix] ?? ''" placeholder="Auto select / Ask every time" clearable
              :disabled="saving" :aria-label="`${row.suffix} default extension`" @change="id => save(row.suffix, id)">
              <el-option v-if="row.unavailable" :value="row.unavailable" :label="`${row.unavailable} (unavailable)`" disabled />
              <el-option v-for="extension in row.candidates" :key="extension.id" :value="extension.id" :label="`${extension.displayName} · ${extension.id}`" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer><el-button @click="visible = false">Done</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { ElAlert, ElButton, ElDialog, ElMessage, ElOption, ElSelect, ElTable, ElTableColumn } from "element-plus";
import { extensionAssociations, listExtensions, setExtensionAssociation, type InstalledExtension } from "@/pages/workspace/panels/document/extensions";

const visible = defineModel<boolean>({ required: true });
const extensions = shallowRef<InstalledExtension[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const rows = computed(() => {
  const available = extensions.value.filter(extension => extension.enabled && !extension.loadError);
  const suffixes = new Set([...Object.keys(extensionAssociations.value), ...available.flatMap(extension => extension.resourceKind === "canvasNode" ? ["canvasNode"] : extension.extensions)]);
  return [...suffixes].sort().map(suffix => {
    const candidates = available.filter(extension => suffix === "canvasNode" ? extension.resourceKind === "canvasNode" : extension.resourceKind === "file" && extension.extensions.includes(suffix));
    const selected = extensionAssociations.value[suffix];
    return { suffix, candidates, unavailable: selected && !candidates.some(extension => extension.id === selected) ? selected : undefined };
  });
});

watch(visible, async value => {
  if (!value) return;
  loading.value = true;
  error.value = "";
  try { extensions.value = await listExtensions(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "Failed to read file extensions"; }
  finally { loading.value = false; }
}, { immediate: true });

async function save(suffix: string, id: string) {
  saving.value = true;
  try { await setExtensionAssociation(suffix, id || undefined); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "Failed to save default open-with setting"); }
  finally { saving.value = false; }
}
</script>

<style scoped lang="scss">
.extensionAssociations {
  p { margin: 0 0 16px; color: var(--el-text-color-secondary); line-height: 1.6; }
  :deep(.el-select) { width: 100%; }
}
</style>
