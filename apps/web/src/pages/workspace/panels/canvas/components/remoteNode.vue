<template>
  <nodeSkeleton v-if="loading" loading :label="node.data.label || node.type" :handles="node.data.handles" :outputs="node.data.outputs" />
  <component v-else-if="component && !error && !runtimeError" :is="component" v-bind="$attrs" />
  <el-card v-else class="remoteNodeState failed" shadow="never" role="alert">
    <div class="stateHeader">
      <strong>{{ node.data.label || node.type }}</strong>
      <span class="stateLabel">error</span>
      <div class="stateActions nodrag nopan" @pointerdown.stop @mousedown.stop @dblclick.stop>
        <el-button :icon="IconRefresh" text :loading="reloading" title="Reload node" aria-label="Reload node" @click.stop="retry" />
        <el-button :icon="IconX" text title="Remove node" aria-label="Remove node" @click.stop="removeNodes(node.id)" />
      </div>
    </div>
    <p>{{ error || runtimeError || "Remote node not loaded. Please verify plugin is installed and enabled" }}</p>
  </el-card>
</template>

<script setup lang="ts">
import { inject, onErrorCaptured, ref, watch, type Component } from "vue";
import { useNode, useVueFlow } from "@vue-flow/core";
import { ElButton, ElCard } from "element-plus";
import { IconRefresh, IconX } from "@tabler/icons-vue";
import { nodeSkeleton, type NodeData } from "@toonflow/nodes-scaffold/runtime";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ component?: Component | string; error?: string; loading?: boolean }>();
const { node } = useNode<NodeData>();
const { removeNodes } = useVueFlow();
const reload = inject<((type: string) => Promise<void>)>("reloadRemoteNode");
const runtimeError = ref("");
const reloading = ref(false);

onErrorCaptured(error => {
  runtimeError.value = error instanceof Error ? error.message : String(error);
  console.error(`Remote node ${node.type} (${node.id}) runtime error`, error);
  return false;
});
watch(() => props.component, () => { runtimeError.value = ""; });

async function retry() {
  if (!reload || reloading.value) return;
  reloading.value = true;
  try { await reload(node.type); }
  catch (error) { runtimeError.value = error instanceof Error ? error.message : String(error); }
  finally { reloading.value = false; }
}
</script>

<style scoped lang="scss">
.remoteNodeState {
  width: 320px;
  &.failed { border-color: var(--el-color-danger); }
  .stateHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    strong { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .stateLabel { font-size: 12px; color: var(--el-text-color-secondary); }
    .stateActions {
      display: flex;
      .el-button { width: 28px; height: 28px; margin: 0; padding: 0; }
    }
  }
  &.failed .stateLabel { color: var(--el-color-danger); }
  p { margin: 10px 0 0; font-size: 12px; color: var(--el-text-color-secondary); white-space: pre-wrap; overflow-wrap: anywhere; }
}
</style>
