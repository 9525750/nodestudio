<template>
  <panel class="canvasMenuPanel" position="top-left">
    <el-card class="canvasMenu" shadow="never" :bodyStyle="{ padding: '5px 10px' }">
      <div class="menuContent">
        <el-input v-model="projectNameDraft" class="workspaceNameInput" :style="{ '--workspaceName': JSON.stringify(projectNameDraft || ' ') }" size="small" :title="directory" :disabled="!workspaceStore.project" aria-label="Project name"
          @keydown.stop @keydown.enter="saveProjectName" @keydown.esc.prevent="projectNameDraft = workspaceName" @blur="saveProjectName" />
        <el-divider direction="vertical" />
        <el-popover v-model:visible="canvasListVisible" trigger="click" placement="bottom-start" :width="214" :showArrow="false" :disabled="!directory">
          <template #reference>
            <el-button class="canvasTrigger" text :loading="busy" :disabled="busy || !directory" aria-label="Switch canvas" :aria-expanded="canvasListVisible">
              <span>{{ activeCanvasName }}</span><icon-chevron-down :size="14" />
            </el-button>
          </template>
          <div class="canvasPicker" @keydown.esc="canvasListVisible = false">
            <div class="pickerHeader">
              <span>Canvas</span>
              <el-button class="iconButton" text :icon="IconPlus" :disabled="busy || editingId !== null" aria-label="New canvas" @click="handleAddCanvas" />
            </div>
            <el-scrollbar maxHeight="280px">
              <div v-for="canvas in canvases" :key="canvas.id" class="canvasItem">
                <el-input v-if="editingId === canvas.id" ref="nameInputs" v-model="canvasName" class="nameEditor" size="small" :disabled="busy" :maxlength="120" :aria-label="newCanvasId === canvas.id ? 'New canvas name' : 'Canvas name'" @keydown.stop @keydown.enter="saveCanvas" @blur="saveCanvas" />
                <template v-else>
                  <button class="canvasChoice" type="button" :disabled="busy || editingId !== null" :aria-pressed="activeCanvasId === canvas.id" :title="canvas.name" @click="handleSwitchCanvas(canvas.id)">{{ canvas.name }}</button>
                  <div class="itemAction">
                    <icon-check v-if="activeCanvasId === canvas.id" class="selectedIcon" :size="18" aria-hidden="true" />
                    <el-button class="iconButton renameButton" text :icon="IconEdit" :disabled="busy || editingId !== null" :aria-label="`Edit ${canvas.name}`" title="Edit" @click="editCanvas(canvas)" />
                    <el-button class="iconButton deleteButton" text type="danger" :icon="IconTrash" :disabled="busy || editingId !== null" :aria-label="`Delete ${canvas.name}`" title="Delete canvas" @click="removeCanvas(canvas)" />
                  </div>
                </template>
              </div>
            </el-scrollbar>
            <el-text v-if="renameError" type="danger" role="alert">{{ renameError }}</el-text>
          </div>
        </el-popover>
      </div>
    </el-card>
    <div class="menuExtension"><slot /></div>
  </panel>
</template>

<script setup lang="ts">
import axios from "axios";
import { translate } from "@toonflow/i18n/vue";
import { computed, inject, nextTick, ref, shallowRef, watch, type ShallowRef } from "vue";
import { Panel, useVueFlow, type FlowExportObject } from "@vue-flow/core";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";
import { IconEdit, IconCheck, IconChevronDown, IconPlus, IconTrash } from "@tabler/icons-vue";
import { useWorkspaceStore } from "@/stores/workspace";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { getCanvasAssetDirectories, isCanvasFile } from "@/pages/workspace/canvasFile";

const props = defineProps<{
  directory?: string;
  initialCanvasId?: string;
  activateCanvas?: (id: string, signal?: AbortSignal) => Promise<void>;
  flushSave: (action?: () => Promise<void>) => Promise<void>;
}>();
const workspaceStore = useWorkspaceStore();
const workspaceName = computed(() => workspaceStore.project?.name || "Unnamed workspace");
const projectNameDraft = ref("");
watch([() => workspaceStore.project?.directory, workspaceName], () => {
  projectNameDraft.value = workspaceName.value;
}, { immediate: true });

function saveProjectName(event: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return;
  const project = workspaceStore.project;
  if (project) workspaceStore.renameProject(project.directory, projectNameDraft.value);
  projectNameDraft.value = workspaceName.value;
}

type Canvas = { id: string; name: string; flow?: Pick<FlowExportObject, "nodes" | "edges" | "viewport"> };
const canvases = inject<ShallowRef<Canvas[]>>("canvasList", shallowRef<Canvas[]>([]));
const getRetainedNodes = inject<(id: string) => { id: string; data?: unknown }[]>("canvasAssetNodes", () => []);
const performFileAction = inject<(directory: string, action: "copy" | "rename" | "delete", path: string, target?: string) => Promise<void>>("performWorkspaceFileAction");
const boundCanvas = shallowRef<Canvas>();
const activeCanvasId = defineModel<string>("canvasId", { default: "" });
watch(canvases, () => {
  if (boundCanvas.value) activeCanvasId.value = canvases.value.includes(boundCanvas.value) ? boundCanvas.value.id : "";
}, { flush: "sync" });
const canvasListVisible = ref(false);
const activeCanvasName = computed(() => canvases.value.find(canvas => canvas.id === activeCanvasId.value)?.name || translate("Select canvas"));
const busy = ref(false);
const loadError = ref("");
const editingId = ref<string | null>(null);
const newCanvasId = ref<string | null>(null);
const nameInputs = ref<InputInstance[]>([]);
const canvasName = ref("");
const renameError = ref("");
const { toObject, setNodes, setEdges, setViewport } = useVueFlow();

watch(() => props.directory, async (directory, _previous, onCleanup) => {
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  busy.value = true;
  loadError.value = "";
  boundCanvas.value = undefined;
  activeCanvasId.value = "";
  try {
    if (props.initialCanvasId === undefined) canvases.value = [];
    newCanvasId.value = null;
    editingId.value = null;
    renameError.value = "";
    if (!directory) return;
    if (props.initialCanvasId === "") return;
    if (props.initialCanvasId) {
      await applyCanvas(props.initialCanvasId, directory);
      return;
    }
    let loaded = await listCanvases(directory);
    if (cancelled) return;
    if (!loaded.length) {
      try {
        loaded = [await createCanvasFile(directory, "Canvas 1")];
      } catch (err) {
        if (!axios.isAxiosError<{ data?: { code?: string } }>(err) || err.response?.status !== 409 || err.response.data.data?.code !== "EEXIST") throw err;
        // When multiple tabs open workspace simultaneously, read the default canvas created by another request without overwriting.
        const refreshed = await listCanvases(directory);
        // If canvas1.json is occupied by another JSON, use the next available name, keeping the original file.
        loaded = refreshed.length ? refreshed : [await createCanvasFile(directory)];
      }
    }
    if (cancelled) return;
    canvases.value = loaded;
    if (canvases.value[0]) await applyCanvas(canvases.value[0].id, directory);
  } catch (err) {
    if (!cancelled) {
      loadError.value = errorMessage(err, "Failed to load canvas");
      if (!props.initialCanvasId) ElMessage.error(loadError.value);
    }
  } finally {
    if (!cancelled) busy.value = false;
  }
}, { immediate: true });

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(err) ? err.response?.data.message || fallback : err instanceof Error ? err.message : fallback;
}

function getCanvases() {
  return canvases.value.map(({ id, name }) => ({ id, name }));
}

function getCanvasDirectory(signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!props.directory) throw new Error("Please select a working directory first");
  if (busy.value || editingId.value !== null) throw new Error("Canvas is loading or editing, please try again later");
  return props.directory;
}

function checkCanvasDirectory(directory: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (props.directory !== directory) throw new Error("Working directory has changed, canvas operation stopped");
}

async function applyCanvas(canvasId: string, directory: string, signal?: AbortSignal) {
  checkCanvasDirectory(directory, signal);
  const nextCanvas = canvases.value.find(canvas => canvas.id === canvasId);
  const currentCanvas = canvases.value.find(canvas => canvas.id === activeCanvasId.value);
  if (!nextCanvas) throw new Error("Canvas does not exist, please refresh canvas list");
  if (nextCanvas === currentCanvas) return;
  if (currentCanvas && props.activateCanvas) {
    await props.activateCanvas(canvasId, signal);
    checkCanvasDirectory(directory, signal);
    return;
  }
  if (!nextCanvas.flow) {
    const data = await useWorkspaceFiles(directory).readJson<Partial<NonNullable<Canvas["flow"]>> & { toonflowCanvas?: boolean } | null>(nextCanvas.id);
    checkCanvasDirectory(directory, signal);
    if (data?.toonflowCanvas !== true || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !data.viewport
      || ![data.viewport.x, data.viewport.y, data.viewport.zoom].every(Number.isFinite) || data.viewport.zoom <= 0) throw new Error("Invalid canvas file format");
    // Old canvas may have saved temporary export progress; tasks no longer exist on reopen.
    for (const node of data.nodes) if (node.type === "remote-videoNode" && node.data) delete node.data.exportProgress;
    nextCanvas.flow = { nodes: data.nodes, edges: data.edges, viewport: data.viewport };
  }
  await props.flushSave();
  checkCanvasDirectory(directory, signal);
  if (currentCanvas) currentCanvas.flow = toObject();
  // Temporarily clear filename when applying canvas data to prevent init triggering auto-save.
  activeCanvasId.value = "";
  setNodes(nextCanvas.flow.nodes);
  // Hit width is configured globally by canvas, not using override values from old files.
  setEdges(nextCanvas.flow.edges.map(({ interactionWidth, ...edge }) => edge));
  await setViewport(nextCanvas.flow.viewport);
  await nextTick();
  checkCanvasDirectory(directory);
  boundCanvas.value = nextCanvas;
  activeCanvasId.value = nextCanvas.id;
  signal?.throwIfAborted();
}

async function switchCanvas(canvasId: string, signal?: AbortSignal) {
  const directory = getCanvasDirectory(signal);
  canvasListVisible.value = false;
  busy.value = true;
  try {
    if (props.activateCanvas) await props.activateCanvas(canvasId, signal);
    else await applyCanvas(canvasId, directory, signal);
    checkCanvasDirectory(directory, signal);
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

async function handleSwitchCanvas(canvasId: string) {
  const directory = props.directory;
  try {
    await switchCanvas(canvasId);
  } catch (err) {
    if (props.directory === directory) ElMessage.error(errorMessage(err, "Failed to switch canvas"));
  }
}

async function removeCanvas(canvas: Canvas) {
  if (busy.value || editingId.value !== null || !props.directory) return;
  const directory = props.directory;
  const id = canvas.id;
  busy.value = true;
  canvasListVisible.value = false;
  try {
    const confirmed = await ElMessageBox.confirm(`Confirm delete “${canvas.name}”? The corresponding ${id} file and exclusive node assets will be deleted. Shared assets will be kept. This cannot be undone.`, “Delete canvas”, {
      type: "warning", confirmButtonText: "Delete", cancelButtonText: "Cancel", closeOnClickModal: false,
    }).then(() => true, () => false);
    if (!confirmed) return;
    checkCanvasDirectory(directory);
    const nextCanvas = canvases.value.find(item => item.id !== id);
    if (nextCanvas && activeCanvasId.value === id) await applyCanvas(nextCanvas.id, directory);
    const files = useWorkspaceFiles(directory);
    const readNodes = async (canvasId: string) => {
      const data = await files.readJson<{ toonflowCanvas?: boolean; nodes?: { id: string; data?: unknown }[] }>(canvasId);
      if (data?.toonflowCanvas !== true || !Array.isArray(data.nodes) || data.nodes.some(node => !node || typeof node.id !== "string")) {
        throw new Error(`Cannot verify ${canvasId}  asset references`);
      }
      return [...data.nodes, ...getRetainedNodes(canvasId)];
    };
    let removedNodes: { id: string; data?: unknown }[] = [];
    await props.flushSave(async () => {
      checkCanvasDirectory(directory);
      if (canvas.id !== id || !canvases.value.includes(canvas)) throw new Error("Canvas has changed, please select again");
      removedNodes = await readNodes(id);
      if (!performFileAction) {
        await files.remove(id);
        checkCanvasDirectory(directory);
        canvases.value = canvases.value.filter(item => item !== canvas);
        await nextTick();
      }
    });
    // Coordinator enters save critical section; must be called after previous flush, avoiding save queue re-entry.
    if (performFileAction) await performFileAction(directory, "delete", id);
    await props.flushSave(async () => {
      checkCanvasDirectory(directory);
      const retainedNodes = (await Promise.all((await listCanvases(directory, true)).map(canvas => readNodes(canvas.id)))).flat();
      const assetDirectories = getCanvasAssetDirectories(removedNodes, retainedNodes);
      checkCanvasDirectory(directory);
      const results = await Promise.allSettled(assetDirectories.map(path => files.remove(path, true).catch(error => {
        if (!axios.isAxiosError<{ data?: { code?: string } }>(error) || error.response?.data.data?.code !== "ENOENT") throw error;
      })));
      const failed = results.flatMap((result, index) => result.status === "rejected" ? [assetDirectories[index]] : []);
      if (failed.length) throw new Error(`Canvas deleted, but ${failed.length} asset directories failed to clean up: ${failed.join(", ")}`);
    });
    if (props.directory === directory) ElMessage.success("Canvas deleted");
  } catch (err) {
    if (props.directory === directory) ElMessage.error(errorMessage(err, "Failed to delete canvas"));
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

async function createCanvasFile(directory: string, name?: string, signal?: AbortSignal) {
  if (name !== undefined) name = normalizeCanvasName(name);
  const files = useWorkspaceFiles(directory);
  const flow = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  for (let number = 1; ; number++) {
    checkCanvasDirectory(directory, signal);
    const canvasName = name ?? `Canvas ${number}`;
    const id = `${canvasName}.json`;
    try {
      await files.writeJson(id, { toonflowCanvas: true, ...flow }, true);
      return { id, name: canvasName, flow };
    } catch (err) {
      if (name !== undefined || !axios.isAxiosError<{ data?: { code?: string } }>(err) || err.response?.status !== 409 || err.response.data.data?.code !== "EEXIST") throw err;
    }
  }
}

async function listCanvases(directory: string, recursive = false): Promise<Canvas[]> {
  const files = useWorkspaceFiles(directory);
  const { entries } = await files.list();
  if (recursive) {
    // File API returns only regular files and directories, no symlinks; asset directories are excluded from canvas scan.
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      if (entry.type === "directory" && entry.name.toLowerCase() !== "assets") entries.push(...(await files.list(entry.path)).entries);
    }
  }
  const loaded = await Promise.all(entries.filter(entry => entry.type === "file" && /\.json$/i.test(entry.name)).map(async entry => {
    if (!(await isCanvasFile(files, entry.path))) return null;
    return { id: entry.path, name: entry.name.slice(0, -5) };
  }));
  return loaded.filter(canvas => canvas !== null).sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
}

async function addCanvas(name?: string, signal?: AbortSignal): Promise<string> {
  const directory = getCanvasDirectory(signal);
  busy.value = true;
  try {
    const canvas = await createCanvasFile(directory, name, signal);
    checkCanvasDirectory(directory);
    canvases.value = [...canvases.value, canvas];
    signal?.throwIfAborted();
    await applyCanvas(canvas.id, directory, signal);
    canvasListVisible.value = false;
    return canvas.id;
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

async function handleAddCanvas() {
  if (busy.value || editingId.value !== null || !props.directory) return;
  const directory = props.directory;
  busy.value = true;
  try {
    const canvas = await createCanvasFile(directory);
    checkCanvasDirectory(directory);
    canvases.value = [...canvases.value, canvas];
    newCanvasId.value = canvas.id;
    busy.value = false;
    await editCanvas(canvas);
  } catch (err) {
    if (props.directory === directory) ElMessage.error(errorMessage(err, "Failed to create canvas"));
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

async function editCanvas(canvas: { id: string; name: string }) {
  if (busy.value || editingId.value !== null) return;
  editingId.value = canvas.id;
  canvasName.value = canvas.name;
  renameError.value = "";
  await nextTick();
  nameInputs.value[0]?.focus();
  nameInputs.value[0]?.select();
}

async function finishEdit() {
  if (busy.value) return;
  editingId.value = null;
  renameError.value = "";
  const createdId = newCanvasId.value;
  newCanvasId.value = null;
  if (createdId) await handleSwitchCanvas(createdId);
}

function normalizeCanvasName(name: string) {
  name = name.trim();
  if (!name || name.length > 120 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw new Error("Canvas name is not a valid filename");
  }
  return name;
}

async function renameCanvasFile(id: string, name: string, directory: string, signal?: AbortSignal) {
  checkCanvasDirectory(directory, signal);
  const canvas = canvases.value.find(item => item.id === id);
  if (!canvas) throw new Error("Canvas does not exist, please refresh canvas list");
  name = normalizeCanvasName(name);
  if (name === canvas.name) return;
  const target = `${id.slice(0, id.lastIndexOf("/") + 1)}${name}.json`;
  if (performFileAction) {
    await performFileAction(directory, "rename", id, target);
    checkCanvasDirectory(directory, signal);
    return;
  }
  await props.flushSave(async () => {
    checkCanvasDirectory(directory, signal);
    await useWorkspaceFiles(directory).rename(id, target);
    checkCanvasDirectory(directory);
    // When file is renamed, update save path first, then respond to cancel, preventing auto-save from recreating old file.
    if (activeCanvasId.value === id) activeCanvasId.value = target;
    if (newCanvasId.value === id) newCanvasId.value = target;
    if (editingId.value === id) editingId.value = target;
    Object.assign(canvas, { id: target, name });
    canvases.value = [...canvases.value];
    signal?.throwIfAborted();
  });
  checkCanvasDirectory(directory, signal);
}

function syncCanvasPath(previous: string, target: string) {
  if (activeCanvasId.value === previous) activeCanvasId.value = target;
  if (newCanvasId.value === previous) newCanvasId.value = target;
  if (editingId.value === previous) editingId.value = target;
}

async function renameCanvas(canvasId: string, name: string, signal?: AbortSignal) {
  const directory = getCanvasDirectory(signal);
  busy.value = true;
  try {
    await renameCanvasFile(canvasId, name, directory, signal);
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

async function saveCanvas(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return;
  const id = editingId.value;
  if (busy.value || !props.directory || id === null) return;
  const directory = props.directory;
  const canvas = canvases.value.find(item => item.id === id);
  if (!canvasName.value.trim() || canvasName.value.trim() === canvas?.name) {
    await finishEdit();
    return;
  }
  busy.value = true;
  renameError.value = "";
  try {
    await renameCanvasFile(id, canvasName.value, directory);
    busy.value = false;
    await finishEdit();
  } catch (err) {
    if (props.directory === directory) {
      renameError.value = errorMessage(err, "Failed to rename canvas");
      canvasListVisible.value = true;
    }
  } finally {
    if (props.directory === directory) busy.value = false;
  }
}

function syncDocumentNode(canvasId: string, nodeId: string, handleId: string, text: string, inline: boolean) {
  const node = canvases.value.find(canvas => canvas.id === canvasId)?.flow?.nodes.find(node => node.id === nodeId);
  if (!node) return;
  const data = node.data ??= {};
  const output = data.outputs?.[handleId];
  if (output?.dataType === "STRING") output.value = text;
  else if (inline) (data.outputs ??= {})[handleId] = { dataType: "STRING", value: text };
}

defineExpose({ getCanvases, addCanvas, switchCanvas, renameCanvas, syncCanvasPath, syncDocumentNode, loadError });
</script>

<style lang="scss" scoped>
.canvasMenuPanel.vue-flow__panel {
  left: 0;
}

.canvasPicker {
  .iconButton { width: 28px; height: 28px; padding: 0; margin: 0; }

  .pickerHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 8px 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .canvasItem {
    display: flex;
    align-items: center;
    border-radius: var(--el-border-radius-base);

    .nameEditor {
      width: 100%;
      padding: 2px 0;
    }

    &:hover, &:focus-within {
      background: var(--el-fill-color);
      .itemAction {
        .renameButton, .deleteButton { opacity: 1; }
        .selectedIcon { visibility: hidden; }
      }
    }

    .canvasChoice {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border: 0;
      background: transparent;
      color: var(--el-text-color-primary);
      font: inherit;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;

      &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; border-radius: inherit; }
    }

    .itemAction {
      position: relative;
      display: flex;
      flex-shrink: 0;
      width: 56px;
      height: 28px;
      margin-right: 2px;

      .selectedIcon { position: absolute; top: 5px; left: 5px; pointer-events: none; }
      .renameButton, .deleteButton { opacity: 0; }
    }
  }

  @media (hover: none) {
    .canvasItem .itemAction {
      display: flex;
      width: auto;
      align-items: center;
      .selectedIcon { position: static; visibility: visible; }
      .renameButton, .deleteButton { opacity: 1; }
    }
  }
}

.menuExtension {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
}

.canvasMenu {
  margin-left: 100px;

  .menuContent {
    display: flex;
    align-items: center;
    gap: 10px;

    .workspaceNameInput {
      width: auto;
      min-width: 2em;

      &::after {
        content: var(--workspaceName);
        padding: 0 7px;
        white-space: pre;
        visibility: hidden;
      }

      :deep(.el-input__wrapper) {
        position: absolute;
        inset: 0;
        box-shadow: none;
      }

      :deep(.el-input__inner) {
        font-family: inherit;
        font-weight: inherit;
        letter-spacing: inherit;
      }
    }

    .canvasTrigger {
      padding: 0 4px;
      :deep(> span) { display: flex; align-items: center; gap: 6px; }
      span { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
    }
  }
}
</style>
