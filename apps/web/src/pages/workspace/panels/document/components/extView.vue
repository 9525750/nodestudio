<template>
  <section class="extView" :aria-label="context.resource.label" @keydown.ctrl.s.capture.prevent="save" @keydown.meta.s.capture.prevent="save">
    <div v-if="context.error || runtimeError" class="extError" role="alert">
      <span>{{ context.error || runtimeError }}</span>
      <span class="errorActions">
        <el-button v-if="session.conflict" text size="small" @click="reloadDisk">Load disk version</el-button>
        <el-button v-if="context.dirty && session.extension.text" text size="small" @click="saveCopy">Save a copy</el-button>
        <el-button v-if="runtimeError || context.dirty || !session.component" text size="small" @click="retry">Retry</el-button>
      </span>
    </div>
    <div v-if="session.extensionChanged" class="extensionNotice" role="status">Extension updated. Close all tabs using this extension and reopen them to apply the new version.</div>
    <div v-if="session.extensionDisabled" class="extensionNotice" role="status">Extension disabled. Unsaved content is preserved. Please retry saving, save a copy, or re-enable the extension.</div>
    <div v-loading="context.loading && !session.extensionDisabled" class="extContent" :inert="session.extensionDisabled">
      <component v-if="session.component && !runtimeError" :is="session.component" :context="context" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, onBeforeUnmount, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { IDockviewPanelProps } from "dockview-vue";
import type { EditorParams } from "../documentSession";
import { documentError } from "../documentSession";

const props = defineProps<{ params: IDockviewPanelProps<EditorParams> }>();
const session = computed(() => props.params.params.session);
const visible = ref(props.params.api.isVisible);
const visibility = props.params.api.onDidVisibilityChange(event => { visible.value = event.isVisible; });
onBeforeUnmount(() => visibility.dispose());
const context = computed(() => new Proxy(session.value.context, {
  get(target, key, receiver) {
    if (key === "location") return props.params.params.view.location;
    if (key === "active") return visible.value && target.active;
    return Reflect.get(target, key, receiver);
  },
}));
const runtimeError = ref("");
onErrorCaptured(error => { runtimeError.value = error instanceof Error ? error.message : String(error); return false; });
function save() { void context.value.flushSave().catch(() => {}); }
function retry() {
  if (runtimeError.value) { runtimeError.value = ""; return; }
  if (context.value.dirty) save();
  else {
    session.value.ready = session.value.load();
    void session.value.ready.catch(() => {});
  }
}
async function reloadDisk() {
  try {
    await ElMessageBox.confirm("This will replace unsaved changes with the disk content. To keep the current content, save a copy first.", "Load disk version", { type: "warning", confirmButtonText: "Load", cancelButtonText: "Cancel" });
    await session.value.reloadDisk();
  } catch (error) { if (error !== "cancel" && error !== "close") ElMessage.error(documentError(error)); }
}
async function saveCopy() {
  try {
    const path = context.value.resource.path;
    const dot = path.lastIndexOf(".");
    const suggested = dot > path.lastIndexOf("/") ? `${path.slice(0, dot)} copy${path.slice(dot)}` : `${path} copy`;
    const { value } = await ElMessageBox.prompt("Enter a relative path within the workspace. Existing files will not be overwritten.", "Save a copy", { inputValue: suggested, inputValidator: value => !!value?.trim() || "Please enter a file path", confirmButtonText: "Save", cancelButtonText: "Cancel" });
    await context.value.files.write(value.trim(), context.value.text, true);
    ElMessage.success("Copy saved");
  } catch (error) { if (error !== "cancel" && error !== "close") ElMessage.error(documentError(error)); }
}
</script>

<style scoped lang="scss">
.extView {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--el-bg-color);
  .extError {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
    font-size: 12px;
    overflow-wrap: anywhere;
    .errorActions { display: flex; flex-shrink: 0; flex-wrap: wrap; }
  }
  .extensionNotice { padding: 6px 12px; color: var(--el-color-warning); font-size: 12px; }
  .extContent { flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
}
</style>
