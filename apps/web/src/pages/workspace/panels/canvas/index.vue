<template>
  <div
    ref="canvasElement"
    class="canvas"
    :class="{ edgesHidden: !showEdges, handMode, compositingEnabled: generalSettings.canvasCompositingEnabled }"
    :style="{ '--canvasEdgeColor': generalSettings.canvasEdgeColorMode === 'custom' ? generalSettings.canvasEdgeColor : 'var(--el-color-primary)' }"
    @dblclick="openNodeMenu"
    @wheel.capture="zoomCanvas"
    @gesturestart.capture="zoomCanvas"
    @gesturechange.capture="zoomCanvas"
    @gestureend.capture="zoomCanvas"
    @pointermove="pointerPosition = { x: $event.clientX, y: $event.clientY }"
    @pointerleave="pointerPosition = undefined"
    @dragover="dragFilesOver"
    @drop="dropFiles">
    <vue-flow
      :id="runtimeKey"
      :only-render-visible-elements="false"
      :nodes-draggable="true"
      :node-types="nodeTypes"
      :snap-to-grid="snapEnabled"
      :snap-grid="[16, 16]"
      :min-zoom="0.2"
      :max-zoom="8"
      :nodes-connectable="true"
      :connection-mode="ConnectionMode.Strict"
      :nodes-focusable="false"
      :edges-focusable="false"
      :edges-updatable="false"
      :elevate-nodes-on-select="true"
      :elevate-edges-on-select="false"
      :disable-keyboard-a11y="true"
      :selectNodesOnDrag="false"
      :auto-pan-on-node-drag="false"
      :auto-pan-on-connect="false"
      :zoom-on-double-click="false"
      :zoomOnScroll="false"
      :zoomOnPinch="active && !settingsVisible"
      :panOnScroll="active && !settingsVisible"
      :panOnScrollSpeed="1"
      :panOnDrag="handMode ? true : [1]"
      :panOnScrollMode="PanOnScrollMode.Free"
      :delete-key-code="null"
      :selectionKeyCode="!handMode"
      :selectionMode="SelectionMode.Partial"
      :multi-selection-key-code="null"
      :zoomActivationKeyCode="zoomKeyPressed ? true : null"
      :pan-activation-key-code="null"
      v-model="flowData"
      @connect="addEdges"
      @edgeClick="showEdgeDisconnect"
      @paneClick="edgeDisconnect = undefined"
      @moveStart="edgeDisconnect = undefined"
      :default-edge-options="defaultEdgeOptions">
      <template v-for="type in remoteNodeTypes" :key="type" #[`node-${type}`]="nodeProps">
        <remoteNode
          v-bind="nodeProps"
          :component="nodeTypes[type]"
          :error="nodeErrors[type]"
          :loading="nodeLoads.has(type) || (nodeListLoading && !nodeTypes[type] && !nodeErrors[type])" />
      </template>
      <background :gap="16" pattern-color="var(--el-border-color)" />
      <canvasMenu ref="canvasMenuRef" v-model:canvasId="canvasId" :directory="project?.directory" :initialCanvasId="initialCanvasId" :activateCanvas="activateCanvas" :flushSave="flushCanvases ?? flushCanvasSave">
        <assetLibrary ref="assetLibraryRef" v-model="assetsVisible" :directory="project?.directory" />
      </canvasMenu>
      <canvasControls
        ref="canvasControlsRef"
        v-model:assetsVisible="assetsVisible"
        v-model:snapEnabled="snapEnabled"
        v-model:showEdges="showEdges"
        :canvasId="canvasId"
        :directory="project?.directory"
        :batchHistory="canvasHistory.batch"
        @update:showEdges="edgeDisconnect = undefined" />
      <nodeMenu
        :key="JSON.stringify(['nodeMenu', project?.directory, canvasId])"
        ref="nodeMenuRef"
        :remoteNodes="availableNodes"
        :pasteNode="pasteClipboardNode"
        :uploadFiles="canvasId && project?.directory ? selectFiles : undefined"
        :canUndo="canUndo"
        :canRedo="canRedo"
        :selectionBusy="selectionToolbarRef?.busy"
        :batchHistory="canvasHistory.batch"
        @duplicateSelection="selectionToolbarRef?.operate('duplicate')"
        @history="canvasHistory.commit"
        @undo="changeHistory('undo')"
        @redo="changeHistory('redo')" />
      <selectionToolbar
        :key="JSON.stringify(['selectionToolbar', project?.directory, canvasId])"
        ref="selectionToolbarRef"
        :batchHistory="canvasHistory.batch"
        :getSignal="() => canvasController.signal"
        :disabled="!canvasId || !project?.directory" />
      <nodeSearch ref="nodeSearchRef" :disabled="!active || settingsVisible || !canvasId || !project?.directory" />
    </vue-flow>
    <teleport to="body">
      <el-button
        v-if="edgeDisconnect && findEdge(edgeDisconnect.id)"
        class="edgeDisconnect"
        type="danger"
        circle
        aria-label="Disconnect"
        title="Disconnect"
        :style="{ left: `${edgeDisconnect.x}px`, top: `${edgeDisconnect.y}px` }"
        @click.stop="
          removeEdges(edgeDisconnect.id);
          edgeDisconnect = undefined;
        "
        @mouseleave="edgeDisconnect = undefined">
        <icon-unlink :size="16" />
      </el-button>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, onScopeDispose, provide, ref, shallowReactive, shallowRef, watch } from "vue";
import axios from "axios";
import { debounce } from "lodash-es";
import { ElMessage } from "element-plus";
import { storeToRefs } from "pinia";
import { IconUnlink } from "@tabler/icons-vue";
import * as vueRuntime from "vue";
import * as vueFlowRuntime from "@vue-flow/core";
import * as elementPlusRuntime from "element-plus";
import * as threeRuntime from "three";
import { runAgentLoop } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import "element-plus/dist/index.css";
import {
  VueFlow,
  PanOnScrollMode,
  ConnectionMode,
  SelectionMode,
  useVueFlow,
  wheelDelta,
  isNode,
  type Node,
  type Edge,
  type GraphEdge,
  type EdgeMouseEvent,
  type NodeTypesObject,
  type XYPosition,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { useCanvasTools } from "./useCanvasTools";
import type { CanvasContext } from "@toonflow/tool-canvas/runtime";
import { loadNodeComponent } from "./loadNodeComponent";
import { useCanvasHistory } from "./useCanvasHistory";
import { copyNodeToClipboard, copyNodesToClipboard, nodeClipboardCommand, readClipboardNodes } from "./nodeClipboard";
import { readClipboardText } from "@/lib/clipboard";
import nodeMenu from "./components/nodeMenu.vue";
import remoteNode from "./components/remoteNode.vue";
import canvasMenu from "./components/canvasMenu.vue";
import canvasControls from "./components/canvasControls.vue";
import assetLibrary from "./components/assetLibrary.vue";
import groupNode from "./components/groupNode.vue";
import selectionToolbar from "./components/selectionToolbar.vue";
import nodeSearch from "./components/nodeSearch.vue";
import { finishGroupDrag, getSelectionTree } from "./selectionNodes";
import type { NodeOutput } from "@toonflow/nodes-scaffold/values";
import type { NodeConnectionFeedback, NodeHandle } from "@toonflow/nodes-scaffold/connection";
import { useNodeEvent } from "@toonflow/nodes-scaffold/nodeEvent";
import type { NodeDocumentContext, NodeDocumentState } from "@toonflow/nodes-scaffold/nodeDocument";
import { useNodeToolsContext } from "@toonflow/nodes-scaffold/nodeTools";
import { useWorkspaceStore } from "@/stores/workspace";
import { generalSettings } from "@/stores/settings";
import { getShortcutBindings, shortcutLabel, shortcutMatches, shortcutPressed } from "@/lib/canvasShortcuts";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import anonymousData from "@/lib/anonymousData";
import { dropCanvasFiles, importCanvasFiles, isCanvasFileDrag } from "./canvasDrop";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/minimap/dist/style.css";

const props = withDefaults(defineProps<{
  active?: boolean;
  settingsVisible?: boolean;
  runtimeKey?: string;
  initialCanvasId?: string;
  activateCanvas?: (canvasId: string, signal?: AbortSignal) => Promise<void>;
  resolveCanvasContext?: (canvasId: string) => CanvasContext | undefined;
  flushCanvases?: (action?: () => Promise<void>) => Promise<void>;
}>(), { active: true, settingsVisible: false });
const { project } = storeToRefs(useWorkspaceStore());

const canvasElement = ref<HTMLElement>();
const flowData = ref<(Node | Edge)[]>([]);
const canvasId = ref("");
const nodeMenuRef = ref<InstanceType<typeof nodeMenu>>();
const canvasMenuRef = ref<InstanceType<typeof canvasMenu>>();
const canvasControlsRef = ref<InstanceType<typeof canvasControls>>();
const selectionToolbarRef = ref<InstanceType<typeof selectionToolbar>>();
const nodeSearchRef = ref<InstanceType<typeof nodeSearch>>();
const nodeTypes = shallowRef<NodeTypesObject>({ canvasGroup: markRaw(groupNode) });
const nodeConfigs = shallowRef<Record<string, Record<string, unknown>>>({});
const nodeOptions = ref<{ type: string; label: string }[]>([]);
const nodeLoads = shallowReactive(new Map<string, Promise<void>>());
const nodeReloads = new Set<string>();
const nodeErrors = ref<Record<string, string>>({});
const availableNodes = computed(() => nodeOptions.value.filter(node => nodeTypes.value[node.type] && !nodeErrors.value[node.type]));
const nodeListLoading = ref(true);
const remoteNodeTypes = computed(() => [
  ...new Set((flowData.value as { type?: string }[]).map((item) => item.type).filter((type): type is string => !!type?.startsWith("remote-"))),
]);
let loadRequest = 0;
const snapEnabled = ref(false);
const zoomKeyPressed = ref(false);
const panKeyPressed = ref(false);
const selectedTool = ref<"move" | "hand">("move");
const handMode = computed(() => props.active && !props.settingsVisible && (selectedTool.value === "hand" || panKeyPressed.value));
let pointerPosition: XYPosition | undefined;
const pressedCodes = new Set<string>();
let gestureScale: number | undefined;
const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "1";
let copyingNodes = false;
const showEdges = ref(true);
const assetsVisible = ref(false);
const assetLibraryRef = ref<InstanceType<typeof assetLibrary>>();
const edgeDisconnect = ref<{ id: string; x: number; y: number }>();
const flow = useVueFlow(props.runtimeKey);
const nodeDocument: NodeDocumentContext = { targets: shallowReactive(new Map()), mounts: new Map(), states: shallowReactive(new Map()) };
const canvasDirty = ref(false);
const canvasSaveError = ref("");
const documentObservers = new Set<() => void>();
onScopeDispose(() => { for (const release of documentObservers) release(); });
provide("nodeDocument", nodeDocument);
onScopeDispose(anonymousData.observeCanvas(() => props.active && canvasId.value
  ? { nodes: flow.nodes.value, edgeCount: flow.edges.value.length }
  : undefined));
let dragCopy: ReturnType<InstanceType<typeof selectionToolbar>["startDragCopy"]>;
flow.onNodeDragStart(({ event, nodes }) => {
  dragCopy = undefined;
  if (!props.active || props.settingsVisible) return;
  const shortcuts = generalSettings.value.canvasShortcuts;
  const withEdges = shortcutPressed(event, shortcuts.duplicateOnDrag, pressedCodes);
  if (withEdges || shortcutPressed(event, shortcuts.copyOnDrag, pressedCodes)) {
    dragCopy = selectionToolbarRef.value?.startDragCopy(nodes, withEdges);
  }
});
flow.onNodeDrag(() => dragCopy?.update());
flow.onNodeDragStop(({ nodes }) => {
  const copy = dragCopy;
  dragCopy = undefined;
  if (copy) copy.finish();
  else finishGroupDrag(flow.getNodes.value, nodes);
});
const canvasHistory = useCanvasHistory(flow, () =>
  project.value?.directory && canvasId.value ? JSON.stringify([project.value.directory, canvasId.value]) : ""
);
const { canUndo, canRedo } = canvasHistory;
provide("batchCanvasHistory", canvasHistory.batch);
const getNodeTools = useNodeToolsContext();
const { addNodes, addEdges, removeEdges, findEdge, findNode, toObject, viewport, screenToFlowCoordinate } = flow;
provide("copyNodeToClipboard", (node: Parameters<typeof copyNodeToClipboard>[0]) => copyNodeToClipboard(node, project.value?.directory ?? ""));
provide("retainNodeFiles", true);
provide("selectionConnection", shallowRef<NodeConnectionFeedback>());
provide("saveNodeToAssets", (label: string, outputs: { label: string; output: NodeOutput }[]) => assetLibraryRef.value?.openSave(label, outputs));
let canvasController = new AbortController();
let workspaceController = new AbortController();
const createCanvasContext = useCanvasTools({
  availableNodes,
  flushSave: flushCanvasSave,
  menu() {
    if (!canvasMenuRef.value) throw new Error("Canvas menu is not ready");
    return canvasMenuRef.value;
  },
  getCanvasBinding: () => ({ id: canvasId.value, signal: canvasController.signal }),
  resolveCanvasContext: id => props.resolveCanvasContext?.(id),
});
function getCanvasContext() {
  return canvasId.value ? createCanvasContext(canvasId.value, canvasController.signal, workspaceController.signal) : undefined;
}
const canvasReady = computed(() => !!canvasId.value && !nodeListLoading.value && nodeLoads.size === 0);
provide("canvas", getCanvasContext);
defineExpose({ canvasId, canvasReady, getCanvasContext, readDocumentNode, saveDocumentNode, mountDocumentNode, observeDocumentNode, prepareCanvasDelete, flushSave: flushCanvasSave, cancelSave: cancelCanvasSave,
  syncCanvasPath: (previous: string, target: string) => canvasMenuRef.value?.syncCanvasPath(previous, target),
  getMentionNodes: () => flow.nodes.value, findMentionNode: flow.findNode,
  getRetainedNodes: canvasHistory.getRetainedNodes,
  get saveBusy() { return savePaused; }, get loadError() { return canvasMenuRef.value?.loadError ?? ""; },
});

async function prepareCanvasDelete() {
  const directory = project.value?.directory;
  const fileName = canvasId.value;
  const nodes = [...flow.getNodes.value];
  const signal = AbortSignal.any([workspaceController.signal, canvasController.signal]);
  function checkCanvas() {
    signal.throwIfAborted();
    if (!directory || directory !== project.value?.directory || !fileName || fileName !== canvasId.value) {
      throw new Error("Workspace or canvas changed, please delete again");
    }
  }
  checkCanvas();
  await nextTick();
  checkCanvas();
  // Host has paused canvas save; only execute node lifecycle here, host cancels save and unmounts after file deletion.
  for (const node of nodes) {
    if (flow.findNode(node.id) !== node) throw new Error("Canvas nodes changed, please delete again");
    await useNodeEvent(node.id, flow).emit("delete");
    checkCanvas();
    if (flow.findNode(node.id) !== node) throw new Error("Canvas nodes changed, please delete again");
  }
  if (flow.getNodes.value.length !== nodes.length || nodes.some(node => flow.findNode(node.id) !== node)) {
    throw new Error("Canvas nodes changed, please delete again");
  }
}

type DocumentNodeData = { label?: string; handles?: NodeHandle[]; outputs?: Record<string, NodeOutput | undefined>; textPath?: string };

function checkDocumentDirectory(directory: string) {
  if (!directory || directory !== project.value?.directory) throw new Error("Working directory changed, please reopen node");
}

function observeDocumentNode(directory: string, canvasPath: string, nodeId: string, onState: (state: NodeDocumentState) => void) {
  checkDocumentDirectory(directory);
  if (canvasId.value !== canvasPath || !findNode(nodeId)) throw new Error("Node does not exist, please refresh file tree");
  const stop = watch((): NodeDocumentState => {
    const node = findNode(nodeId);
    const state = nodeDocument.states.get(nodeId);
    return { dirty: !!node && (canvasDirty.value || !!state?.dirty),
      error: state?.error || canvasSaveError.value || (node && nodeErrors.value[node.type]) || "", deleted: !node };
  }, onState, { immediate: true, flush: "sync" });
  const release = () => { stop(); documentObservers.delete(dispose); };
  const dispose = () => { onState({ dirty: false, error: "", deleted: true }); release(); };
  documentObservers.add(dispose);
  return {
    release,
    async flushSave() {
      checkDocumentDirectory(directory);
      if (!findNode(nodeId)) throw new Error("Node deleted, please refresh file tree");
      await flushCanvasSave();
    },
  };
}

async function mountDocumentNode(directory: string, canvasPath: string, nodeId: string, target: HTMLElement) {
  checkDocumentDirectory(directory);
  if (canvasId.value !== canvasPath) throw new Error("Canvas changed, please reopen node");
  await nextTick();
  checkDocumentDirectory(directory);
  const node = findNode(nodeId);
  if (!node) throw new Error("Node deleted, please refresh file tree");
  if (nodeErrors.value[node.type]) throw new Error(nodeErrors.value[node.type]);
  const mount = nodeDocument.mounts.get(nodeId);
  if (!mount) throw new Error("Current node does not provide document view, please verify node is loaded and update plugin");
  const release = mount(target);
  try {
    await nextTick();
    checkDocumentDirectory(directory);
    if (!target.isConnected || !target.querySelector(".documentNode")) throw new Error("Node document view failed to load, please reopen node");
    return release;
  } catch (error) {
    release();
    throw error;
  }
}

function documentHandles(node: Node<DocumentNodeData>) {
  const handles = node.data?.handles;
  if (Array.isArray(handles) && handles.length) {
    return handles.filter(
      (handle) =>
        handle &&
        typeof handle.id === "string" &&
        handle.type === "source" &&
        (Array.isArray(handle.dataType) ? handle.dataType.includes("STRING") : handle.dataType === "STRING")
    );
  }
  return Object.entries(node.data?.outputs ?? {}).flatMap(([id, output]) => (output?.dataType === "STRING" ? [{ id, label: id }] : []));
}

async function readDocumentCanvas(directory: string, canvasPath: string, nodeId: string) {
  checkDocumentDirectory(directory);
  const files = useWorkspaceFiles(directory);
  const canvas = await files.readJson<{ toonflowCanvas?: boolean; nodes?: Node<DocumentNodeData>[] }>(canvasPath);
  checkDocumentDirectory(directory);
  if (canvas?.toonflowCanvas !== true || !Array.isArray(canvas.nodes)) throw new Error("File is not a valid canvas");
  const node = canvas.nodes.find((item) => item && item.id === nodeId);
  if (!node) throw new Error("Node deleted, please refresh file tree");
  if (node.data !== undefined && (!node.data || typeof node.data !== "object" || Array.isArray(node.data))) throw new Error("Node data is invalid");
  const liveNode = canvasId.value === canvasPath ? findNode(nodeId) : undefined;
  if (canvasId.value === canvasPath && !liveNode) throw new Error("Node deleted, please refresh file tree");
  const textPath = node.data?.textPath;
  if (
    textPath !== undefined &&
    (typeof textPath !== "string" ||
      !textPath.trim() ||
      /^(?:[a-z][a-z\d+.-]*:|[\\/])/i.test(textPath) ||
      textPath.includes("\0") ||
      textPath.split(/[\\/]/).includes(".."))
  )
    throw new Error("Text file path must be within workspace");
  return { files, canvas, node, liveNode, textPath };
}

async function readDocumentNode(directory: string, canvasPath: string, nodeId: string) {
  checkDocumentDirectory(directory);
  await flushCanvasSave();
  const { files, node, liveNode, textPath } = await readDocumentCanvas(directory, canvasPath, nodeId);
  const source = liveNode ?? node;
  const handles = documentHandles(source);
  const storedText = textPath === undefined ? undefined : await files.readText(textPath);
  checkDocumentDirectory(directory);
  return {
    label: typeof source.data?.label === "string" ? source.data.label : nodeId,
    outputs: handles.map((handle) => {
      const output = source.data?.outputs?.[handle.id];
      return {
        id: handle.id,
        label: handle.label || handle.id,
        text: output?.dataType === "STRING" && typeof output.value === "string" ? output.value : storedText ?? "",
      };
    }),
  };
}

async function saveDocumentNode(directory: string, canvasPath: string, nodeId: string, handleId: string, text: string, expectedText?: string) {
  checkDocumentDirectory(directory);
  await flushCanvasSave(async () => {
    const { files, canvas, node, liveNode, textPath } = await readDocumentCanvas(directory, canvasPath, nodeId);
    if (!documentHandles(liveNode ?? node).some((handle) => handle.id === handleId)) throw new Error("Text output deleted, please reopen node");
    if (expectedText !== undefined) {
      const output = (liveNode ?? node).data?.outputs?.[handleId];
      const currentText = output?.dataType === "STRING" && typeof output.value === "string" ? output.value : textPath === undefined ? "" : await files.readText(textPath);
      if (currentText !== expectedText) throw new Error("Document content has changed, please re-read before editing");
    }
    if (liveNode?.type === "remote-textNode") {
      await getNodeTools().call({ nodeId, name: "node:setText", args: { text } }, canvasController.signal);
      checkDocumentDirectory(directory);
      // Node tools have synced output and queued save; user may continue editing during wait, cannot write old text snapshot.
      return;
    }
    if (liveNode && canvasId.value === canvasPath && findNode(nodeId) === liveNode) {
      const output = liveNode.data.outputs?.[handleId];
      if (output?.dataType === "STRING") output.value = text;
      else if (textPath === undefined) (liveNode.data.outputs ??= {})[handleId] = { dataType: "STRING", value: text };
    }
    canvasMenuRef.value?.syncDocumentNode(canvasPath, nodeId, handleId, text, textPath === undefined);
    if (textPath !== undefined) {
      await files.write(textPath, text);
    } else {
      const data = (node.data ??= {});
      const output = data.outputs?.[handleId];
      if (output?.dataType === "STRING") output.value = text;
      else (data.outputs ??= {})[handleId] = { dataType: "STRING", value: text };
      await files.writeJson(canvasPath, canvas);
    }
    checkDocumentDirectory(directory);
  });
}

function showEdgeDisconnect({ event, edge }: EdgeMouseEvent) {
  if (!(event instanceof MouseEvent)) return;
  event.stopPropagation();
  edgeDisconnect.value = { id: edge.id, x: event.clientX, y: event.clientY };
}

function dragFilesOver(event: DragEvent) {
  if (!props.active || props.settingsVisible || !canvasId.value || !project.value?.directory || !isCanvasFileDrag(event)) return;
  if (!(event.target instanceof Element) || !event.target.closest(".vue-flow__pane")) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
  return true;
}

async function dropFiles(event: DragEvent) {
  const directory = project.value?.directory;
  if (!directory || !dragFilesOver(event)) return;
  try {
    await canvasHistory.batch(() => dropCanvasFiles(event, { directory, availableNodes: availableNodes.value, signal: canvasController.signal, flow }));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "File import failed");
  }
}

function selectFiles(position: { x: number; y: number }) {
  const directory = project.value?.directory;
  if (!props.active || props.settingsVisible || !canvasId.value || !directory) return;
  const context = { directory, availableNodes: availableNodes.value, signal: canvasController.signal, flow };
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files ?? []);
    if (!files.length || context.signal.aborted) return;
    try {
      await canvasHistory.batch(() => importCanvasFiles(files, position, context));
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "File import failed");
    }
  };
  input.click();
}

function openNodeMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.classList.contains("vue-flow__pane")) nodeMenuRef.value?.openMenu(event, true);
}

function addNodeAtPointer() {
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return;
  const position = pointerPosition ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  void nodeMenuRef.value?.openMenu(new MouseEvent("contextmenu", { clientX: position.x, clientY: position.y }), true);
}

async function changeHistory(direction: "undo" | "redo") {
  try {
    await canvasHistory[direction]();
    edgeDisconnect.value = undefined;
  } catch (error) {
    ElMessage.error(
      axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data.message || "Failed to restore canvas"
        : error instanceof Error
        ? error.message
        : "Failed to restore canvas"
    );
  }
}

let saving = Promise.resolve();
let flushing = Promise.resolve();
let saveError: unknown;
let savePaused = false;
let saveCancelled = false;
let changedWhilePaused = false;
let saveRevision = 0;
const saveCanvas = debounce((directory: string, fileName: string) => {
  const flow = toObject();
  const revision = saveRevision;
  // ACT: Same-page saves complete sequentially, preventing slow requests from overwriting later changes; no multi-client concurrent editing.
  saving = saving.then(async () => {
    try {
      await useWorkspaceFiles(directory).writeJson(fileName, { toonflowCanvas: true, nodes: flow.nodes, edges: flow.edges, viewport: flow.viewport });
      saveError = undefined;
      canvasSaveError.value = "";
      if (revision === saveRevision) canvasDirty.value = false;
    } catch (err) {
      saveError = err;
      canvasSaveError.value = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data.message || err.message : err instanceof Error ? err.message : "Canvas save failed";
      ElMessage.error(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data.message || "Canvas save failed"
          : err instanceof Error
          ? err.message
          : "Canvas save failed"
      );
    }
  });
}, 500);

function scheduleCanvasSave() {
  if (saveCancelled) return;
  canvasDirty.value = true;
  saveRevision++;
  if (savePaused) {
    changedWhilePaused = true;
    return;
  }
  const directory = project.value?.directory;
  if (directory && canvasId.value) saveCanvas(directory, canvasId.value);
}

function scheduleCanvasChange() {
  scheduleCanvasSave();
  canvasHistory.record();
}

const elementSaveWatchers = new Map<Node | Edge, () => void>();
const nodeRuntimeFields = new Set([
  "data",
  "computedPosition",
  "handleBounds",
  "selected",
  "dimensions",
  "isParent",
  "resizing",
  "dragging",
  "events",
]);
const edgeRuntimeFields = new Set(["data", "selected", "sourceNode", "targetNode", "sourceX", "sourceY", "targetX", "targetY", "events"]);
// ACT: Scan list only on add/remove/replace; position and data are watched separately, single node change doesn't traverse others.
watch(
  () => [...flow.nodes.value, ...flow.edges.value],
  (elements) => {
    const current = new Set<Node | Edge>(elements);
    for (const [element, stop] of elementSaveWatchers) {
      if (!current.has(element)) {
        stop();
        elementSaveWatchers.delete(element);
      }
    }
    for (const element of elements) {
      if (elementSaveWatchers.has(element)) continue;
      // Consistent with runtime fields excluded by toObject; other custom persistent fields still participate in auto-save.
      const runtimeFields = isNode(element) ? nodeRuntimeFields : edgeRuntimeFields;
      const stopFields = watch(
        () =>
          Object.keys(element)
            .filter((key) => !runtimeFields.has(key))
            .map((key) => Reflect.get(element, key)),
        scheduleCanvasChange,
        { deep: true, flush: "post" }
      );
      const stopData = watch(() => element.data, scheduleCanvasSave, { deep: true, flush: "post" });
      const stopName = isNode(element)
        ? watch(
            () => element.data?.label,
            () => canvasHistory.record(),
            { flush: "post" }
          )
        : () => {};
      elementSaveWatchers.set(element, () => {
        stopFields();
        stopData();
        stopName();
      });
    }
    scheduleCanvasChange();
  },
  { immediate: true, flush: "post" }
);
onScopeDispose(() => elementSaveWatchers.forEach((stop) => stop()));
watch(() => [viewport.value.x, viewport.value.y, viewport.value.zoom], scheduleCanvasSave, { flush: "post" });

watch(
  [() => project.value?.directory, canvasId],
  ([directory, fileName], [previousDirectory, previousFileName]) => {
    if (directory !== previousDirectory) {
      workspaceController.abort(new Error("Workspace changed, canvas operation stopped"));
      workspaceController = new AbortController();
    }
    edgeDisconnect.value = undefined;
    dragCopy = undefined;
    pointerPosition = undefined;
    resetCanvasKeys();
    // Same instance only invalidates on canvas reload; rename only updates save path.
    if (directory !== previousDirectory || !fileName || !previousFileName) {
      canvasController.abort(new Error("Canvas reloaded, canvas call stopped"));
      canvasController = new AbortController();
    }
    if (!savePaused) saveCanvas.flush();
  },
  { flush: "sync" }
);

// ACT: Switching display panel doesn't unmount canvas; only cleans up interaction, doesn't interrupt current tool calls.
watch(() => props.active, (active) => {
  if (!active) assetsVisible.value = false;
  edgeDisconnect.value = undefined;
  dragCopy = undefined;
  pointerPosition = undefined;
  resetCanvasKeys();
}, { flush: "sync" });

function flushCanvasSave(action?: () => Promise<void>): Promise<void> {
  // ACT: Full save and its file operations execute serially; explicit save during rename pause must also wait.
  const next = flushing.then(() => saveCanvasState(action)).then(() => { canvasSaveError.value = ""; }, error => {
    canvasSaveError.value = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data.message || error.message : error instanceof Error ? error.message : "Canvas save failed";
    throw error;
  });
  flushing = next.catch(() => {});
  return next;
}

async function saveCanvasState(action?: () => Promise<void>) {
  if (saveCancelled) throw new Error("Canvas save cancelled");
  await Promise.all(flow.getNodes.value.map((node) => useNodeEvent(node.id, flow).emit("save")));
  await nextTick();
  if (saveCancelled) throw new Error("Canvas save cancelled");
  if (saveError && project.value?.directory && canvasId.value) saveCanvas(project.value.directory, canvasId.value);
  if (action) savePaused = true;
  try {
    let revision: number;
    do {
      if (saveCancelled) throw new Error("Canvas save cancelled");
      revision = saveRevision;
      if (changedWhilePaused && project.value?.directory && canvasId.value) {
        saveCanvas(project.value.directory, canvasId.value);
        changedWhilePaused = false;
      }
      saveCanvas.flush();
      await saving;
      if (saveError) throw saveError;
      // Nodes may finish generation during canvas write; re-save changes after new additions are written to disk.
      await Promise.all(flow.getNodes.value.map((node) => useNodeEvent(node.id, flow).emit("save")));
      await nextTick();
    } while (revision !== saveRevision);
    if (saveCancelled) throw new Error("Canvas save cancelled");
    await action?.();
  } finally {
    if (action && !saveCancelled) {
      savePaused = false;
      if (changedWhilePaused && project.value?.directory && canvasId.value) saveCanvas(project.value.directory, canvasId.value);
      changedWhilePaused = false;
    }
  }
}

function cancelCanvasSave() {
  saveCancelled = true;
  savePaused = true;
  changedWhilePaused = false;
  saveCanvas.cancel();
}
function canUseCanvasClipboard(event: Event) {
  const target = event.target;
  return props.active && !event.defaultPrevented && !props.settingsVisible && !!canvasId.value && !!project.value?.directory
    && target instanceof Element
    && !target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='slider'], [role='dialog'], #agentPanel")
    && (target === document.body || target === document.documentElement || canvasElement.value?.contains(target));
}

function beforeClipboard(event: Event) {
  if (!canUseCanvasClipboard(event)) return;
  if (event.type === "beforecopy" && (!flow.getSelectedNodes.value.length || window.getSelection()?.toString())) return;
  // ACT: WKWebView uses beforecopy/beforepaste to determine if non-input areas can use native edit menus.
  event.preventDefault();
}

function copyNode(event: ClipboardEvent) {
  if (!canUseCanvasClipboard(event) || !flow.getSelectedNodes.value.length || window.getSelection()?.toString()) return;
  event.preventDefault();
  void copySelectedNodes();
}

async function copySelectedNodes() {
  if (copyingNodes || !project.value?.directory) return;
  const nodes = getSelectionTree(flow.getSelectedNodes.value, flow.getNodes.value);
  if (!nodes.length) return;
  const directory = project.value.directory;
  const signal = canvasController.signal;
  copyingNodes = true;
  try {
    const ids = new Set(nodes.map(node => node.id));
    const snapshot = toObject();
    const savedNodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    const copies = await Promise.all(nodes.map(async node => {
      const patch = await useNodeEvent(node.id, flow).emit("copy");
      const saved = savedNodes.get(node.id)!;
      const parentNode = ids.has(saved.parentNode ?? "") ? saved.parentNode : undefined;
      return { ...saved, data: { ...saved.data, ...patch }, parentNode,
        ...(saved.parentNode && !parentNode ? { extent: undefined, expandParent: false } : {}),
        position: parentNode ? { ...saved.position } : { x: node.computedPosition.x, y: node.computedPosition.y } };
    }));
    signal.throwIfAborted();
    if (nodes.some(node => findNode(node.id) !== node)) throw new Error("Nodes changed, please copy again");
    const edges = snapshot.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    await copyNodesToClipboard(copies, edges, directory);
  } catch (error) {
    if (!signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Node copy failed");
  } finally {
    copyingNodes = false;
  }
}

async function pasteNode(event: ClipboardEvent) {
  if (!canUseCanvasClipboard(event)) return;
  const command = event.clipboardData?.getData("text/plain") ?? "";
  if (!nodeClipboardCommand.test(command)) return;
  event.preventDefault();
  await pasteNodeAtCenter(command);
}

async function pasteNodeAtCenter(command?: string) {
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return;
  const position = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  await pasteClipboardNode(position, command);
}

async function pasteClipboardNode(position: { x: number; y: number }, command?: string) {
  if (!props.active || !canvasId.value || !project.value?.directory) return false;
  const canvasSignal = canvasController.signal;
  try {
    const directory = project.value.directory;
    const snapshot = await readClipboardNodes(command ?? (await readClipboardText()), directory);
    if (canvasSignal.aborted) return false;
    if (!snapshot) throw new Error("No pasteable node command in clipboard");
    if (snapshot.nodes.some(node => node.type !== "canvasGroup" && !availableNodes.value.some(item => item.type === node.type))) {
      throw new Error("Please install and enable corresponding node plugin first");
    }
    const ids = new Map(snapshot.nodes.map(node => [node.id, crypto.randomUUID()]));
    const roots = snapshot.nodes.filter(node => !node.parentNode);
    const left = Math.min(...roots.map(node => node.position.x));
    const top = Math.min(...roots.map(node => node.position.y));
    await canvasHistory.batch(async () => {
      flow.removeSelectedElements();
      addNodes(snapshot.nodes.map(node => ({ ...node, id: ids.get(node.id)!, parentNode: ids.get(node.parentNode ?? ""), selected: true,
        position: node.parentNode ? node.position : { x: position.x + node.position.x - left, y: position.y + node.position.y - top } })));
      await nextTick();
      if (canvasSignal.aborted) return;
      addEdges(snapshot.edges.map(edge => ({ ...edge, id: crypto.randomUUID(), source: ids.get(edge.source)!, target: ids.get(edge.target)! })));
    });
    return true;
  } catch (error) {
    const pasteShortcut = generalSettings.value.canvasShortcuts.paste;
    const clipboardMessage = getShortcutBindings(pasteShortcut).some(binding => /^(Ctrl|Meta)\+KeyV$/.test(binding))
      ? `Cannot read clipboard, press ${shortcutLabel(pasteShortcut)} paste`
      : "Cannot read clipboard, please allow browser clipboard access";
    if (!canvasSignal.aborted)
      ElMessage.error(
        error instanceof DOMException && error.name === "NotAllowedError" ? clipboardMessage : error instanceof Error ? error.message : "Node paste failed"
      );
    return false;
  }
}

function zoomCanvas(event: WheelEvent | (Event & { scale: number })) {
  if (event.type === "gestureend") gestureScale = undefined;
  if (!props.active || props.settingsVisible || document.fullscreenElement || flow.userSelectionActive.value) return;
  if (!(event.target instanceof Element) || !event.target.closest(".vue-flow__pane, .vue-flow__node, .vue-flow__edge, .vue-flow__nodesselection")) return;
  let factor: number;
  let point = pointerPosition;
  if ("scale" in event) {
    if (!Number.isFinite(event.scale) || event.scale <= 0) return;
    factor = event.type === "gesturechange" && gestureScale !== undefined ? event.scale / gestureScale : 1;
    gestureScale = event.type === "gestureend" ? undefined : event.scale;
  } else {
    // ACT: Chromium pinch sends Ctrl+wheel but no Control key; WebKit uses native gesture events above.
    const pinching = event.ctrlKey && !pressedCodes.has("ControlLeft") && !pressedCodes.has("ControlRight");
    if (!pinching && !shortcutPressed(event, generalSettings.value.canvasShortcuts.zoom, pressedCodes)) {
      if (!event.ctrlKey) return;
      // When physical Ctrl is not bound to zoom, prevent Vue Flow and node skeleton from treating it as pinch.
      factor = 1;
    } else {
      factor = pinching && gestureScale !== undefined ? 1 : 2 ** (pinching ? -event.deltaY * 0.02 : wheelDelta(event));
    }
    point = { x: event.clientX, y: event.clientY };
  }
  const zoom = flow.d3Zoom.value;
  const selection = flow.d3Selection.value;
  if (!zoom || !selection) return;
  event.preventDefault();
  event.stopPropagation();
  if (factor === 1) return;
  const bounds = selection.node()?.getBoundingClientRect();
  if (!bounds) return;
  point ??= { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  selection.call<[number, [number, number], Event]>(zoom.scaleBy, factor, [point.x - bounds.left, point.y - bounds.top], event);
}

function updateCanvasKeys(event: KeyboardEvent) {
  if (event.type === "keydown") {
    pressedCodes.add(event.code);
  } else pressedCodes.delete(event.code);
  if (!props.active || props.settingsVisible) return resetCanvasKeys();
  const target = event.target;
  const shortcuts = generalSettings.value.canvasShortcuts;
  const inCanvas =
    target instanceof Element &&
    !target.closest("[role='dialog'], #agentPanel") &&
    (target === document.body || target === document.documentElement || canvasElement.value?.contains(target));
  zoomKeyPressed.value = !event.isComposing && shortcutPressed(event, shortcuts.zoom, pressedCodes);
  const editing =
    !(target instanceof Element) ||
    !!target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='slider']");
  panKeyPressed.value = !!inCanvas && !editing && !event.isComposing && shortcutPressed(event, shortcuts.pan, pressedCodes);
  if (event.type === "keyup" || event.defaultPrevented || event.isComposing || !inCanvas || editing) return;
  const action = ([
    "group", "mergeGroup", "ungroup", "addNode", "moveTool", "handTool", "arrange", "search",
    "delete", "copy", "paste", "undo", "redo", "zoomIn", "zoomOut", "fitView",
  ] as const).find((action) =>
    shortcutMatches(event, shortcuts[action])
  );
  if (!action) {
    const nativeClipboardKey = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
      && (event.code === "KeyV" || event.code === "KeyC" && flow.getSelectedNodes.value.length && !window.getSelection()?.toString());
    if (panKeyPressed.value || nativeClipboardKey) event.preventDefault();
    return;
  }
  if (!canvasId.value || !project.value?.directory) return;
  if (action === "copy" && (!flow.getSelectedNodes.value.length || window.getSelection()?.toString())) return;
  // Desktop shortcuts reuse native clipboard bridge; browser Ctrl/Cmd+V keeps native events to avoid extra read permissions.
  if (!isDesktop && action === "paste" && event.code === "KeyV" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) return;
  event.preventDefault();
  if (event.repeat) return;
  if (action === "delete") {
    const nodes = [...flow.getSelectedNodes.value];
    const menu = nodeMenuRef.value;
    if (!menu || !nodes.some((node) => node.deletable !== false)) return;
    void canvasHistory
      .batch(() => menu.deleteSelection(nodes))
      .catch((error) => {
        ElMessage.error(error instanceof Error ? error.message : "Node delete failed");
      });
    return;
  }
  if (action === "copy") void copySelectedNodes();
  else if (action === "paste") void pasteNodeAtCenter();
  else if (action === "undo" || action === "redo") void changeHistory(action);
  else if (action === "group" || action === "mergeGroup" || action === "ungroup") {
    void selectionToolbarRef.value?.operate(action);
  } else if (action === "addNode") addNodeAtPointer();
  else if (action === "moveTool" || action === "handTool") selectedTool.value = action === "handTool" ? "hand" : "move";
  else if (action === "arrange") void canvasControlsRef.value?.arrangeNodes();
  else if (action === "search") nodeSearchRef.value?.open();
  else void flow[action]();
}

function resetCanvasKeys() {
  pressedCodes.clear();
  gestureScale = undefined;
  zoomKeyPressed.value = false;
  panKeyPressed.value = false;
}

watch([() => props.settingsVisible, () => generalSettings.value.canvasShortcuts], resetCanvasKeys, { deep: true, flush: "sync" });

function refreshInstalled(event: WindowEventMap["toonflow:plugin-installed"]) {
  if (event.detail.type === "node") void loadRemoteNodes(event.detail.name);
}

const refreshNodeConfig = () => { void loadRemoteNodes(); };

onMounted(() => {
  // Sync modifier keys in capture phase to prevent zoom state loss or sticking after node editor captures keydown/keyup.
  window.addEventListener("keydown", updateCanvasKeys, true);
  window.addEventListener("keyup", updateCanvasKeys, true);
  window.addEventListener("blur", resetCanvasKeys);
  window.addEventListener("toonflow:plugin-installed", refreshInstalled);
  window.addEventListener("toonflow:node-config-updated", refreshNodeConfig);
  document.addEventListener("paste", pasteNode);
  document.addEventListener("copy", copyNode);
  document.addEventListener("beforecopy", beforeClipboard);
  document.addEventListener("beforepaste", beforeClipboard);
  void loadRemoteNodes();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", updateCanvasKeys, true);
  window.removeEventListener("keyup", updateCanvasKeys, true);
  window.removeEventListener("blur", resetCanvasKeys);
  window.removeEventListener("toonflow:plugin-installed", refreshInstalled);
  window.removeEventListener("toonflow:node-config-updated", refreshNodeConfig);
  document.removeEventListener("paste", pasteNode);
  document.removeEventListener("copy", copyNode);
  document.removeEventListener("beforecopy", beforeClipboard);
  document.removeEventListener("beforepaste", beforeClipboard);
  workspaceController.abort(new Error("Workspace closed"));
  canvasController.abort(new Error("Canvas closed"));
  saveCanvas.flush();
  loadRequest++;
});

const nodeWindow = window as typeof window & {
  toonflowNodeHost?: { vue: typeof vueRuntime; vueFlow: typeof vueFlowRuntime; elementPlus: typeof elementPlusRuntime; three: typeof threeRuntime; ai: { runAgentLoop: typeof runAgentLoop; createAssistantMessageEventStream: typeof createAssistantMessageEventStream } };
  toonflowNodes?: NodeTypesObject;
};
nodeWindow.toonflowNodeHost = { vue: vueRuntime, vueFlow: vueFlowRuntime, elementPlus: elementPlusRuntime, three: threeRuntime, ai: { runAgentLoop, createAssistantMessageEventStream } };
provide("nodeConfig", (nodeType: string) => nodeConfigs.value[nodeType] ?? {});
provide("workspaceFiles", () => {
  const directory = project.value?.directory;
  if (!directory) throw new Error("Please select a working directory first");
  return useWorkspaceFiles(directory);
});
provide("workspaceDirectory", () => {
  const directory = project.value?.directory;
  if (!directory) throw new Error("Please select a working directory first");
  return directory;
});
provide("reloadRemoteNode", (type: string) => {
  const name = type.replace(/^remote-/, "");
  if (!type.startsWith("remote-") || !/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new Error("Invalid node type");
  return loadNode(name, `/api/nodes/files?name=${name}`, true);
});

async function loadNode(name: string, url: string, force = false): Promise<void> {
  const nodeType = `remote-${name}`;
  const signal = canvasController.signal;
  const pending = nodeLoads.get(nodeType);
  if (pending) {
    if (!force) return pending;
    await pending.catch(() => {});
  }
  if (!force && nodeTypes.value[nodeType] && !nodeErrors.value[nodeType]) return;
  if (force) {
    signal.throwIfAborted();
    // ACT: Reuse edits during canvas revision convergence wait; defer refresh on continuous canvas changes, no extra node revision state.
    let revision: number;
    do {
      revision = saveRevision;
      await Promise.all(flow.getNodes.value.filter(node => node.type === nodeType).map(node => useNodeEvent(node.id, flow).emit("save", "reload")));
      await nextTick();
      signal.throwIfAborted();
    } while (revision !== saveRevision);
    const loading = nodeLoads.get(nodeType);
    if (loading) return loading;
  }
  delete nodeErrors.value[nodeType];
  const nodeLoad = loadNodeComponent(name, url, force)
    .then((remoteNode) => {
      // Same-type nodes share component; runtime errors are shown by each node's own error boundary.
      nodeTypes.value = { ...nodeTypes.value, [nodeType]: markRaw(remoteNode) };
    })
    .catch((error) => {
      nodeErrors.value[nodeType] = error instanceof Error ? error.message : String(error);
      throw error;
    })
    .finally(() => nodeLoads.delete(nodeType));
  nodeLoads.set(nodeType, nodeLoad);
  return nodeLoad;
}

async function loadRemoteNodes(reloadName?: string) {
  if (reloadName) nodeReloads.add(reloadName);
  const requestId = ++loadRequest;
  const signal = canvasController.signal;
  nodeListLoading.value = true;
  try {
    const { data } = await axios.get<{ code: number; data: { name: string; displayName: string; url: string; enabled?: boolean; config?: Record<string, unknown> }[] }>(
      "/api/nodes/get",
      { headers: { "Cache-Control": "no-cache", "x-toonflow-workspace": "1" } }
    );
    if (requestId !== loadRequest) return;
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error("Node list format error");
    const nodes = data.data.filter(node => {
      if (!node || typeof node.name !== "string" || !/^[a-z][a-zA-Z0-9]*$/.test(node.name) || node.url !== `/api/nodes/files?name=${node.name}`) {
        console.error("Invalid node address", node);
        return false;
      }
      return true;
    });
    nodeConfigs.value = Object.fromEntries(nodes.map(node => [`remote-${node.name}`, node.config ?? {}]));
    const enabledNodes = nodes.filter(node => node.enabled !== false);
    // Nodes appear in menu as soon as individually loaded, without waiting for other nodes' scripts.
    nodeOptions.value = enabledNodes.map(node => ({ type: `remote-${node.name}`, label: node.displayName }))
      .sort((left, right) => left.type.localeCompare(right.type));
    // ACT: Install events merge into latest list request, preventing loss of earlier refresh names when updating different nodes.
    const reloadNames = new Set(nodeReloads);
    nodeReloads.clear();
    await Promise.all(
      enabledNodes.map(async (node) => {
        const nodeType = `remote-${node.name}`;
        try {
          if (nodeTypes.value[nodeType] && !nodeErrors.value[nodeType] && !reloadNames.has(node.name)) return;
          await loadNode(node.name, node.url, reloadNames.has(node.name));
        } catch (error) {
          console.error("Failed to load remote node", node, error);
          // When save is rejected, old component remains usable and isn't removed from node menu; script load errors still excluded.
          if (nodeTypes.value[nodeType] && !nodeErrors.value[nodeType]) {
            if (reloadNames.has(node.name) && !signal.aborted) ElMessage.warning({
              message: `${node.displayName}installed, but current node cannot be refreshed. Please wait for tasks to finish, then click the refresh button.`,
              grouping: true,
            });
          }
        }
      })
    );
  } catch (error) {
    if (requestId === loadRequest) console.error("Failed to get remote node list", error);
  } finally {
    if (requestId === loadRequest) nodeListLoading.value = false;
  }
}

const defaultEdgeOptions = markRaw({
  type: "simple-bezier",
  animated: false,
  class: ({ sourceNode, targetNode }: GraphEdge) => {
    if (!sourceNode.selected && !sourceNode.dragging && !targetNode.selected && !targetNode.dragging) return "";
    return [generalSettings.value.canvasEdgeColorMode !== "none" && "edgeActive", generalSettings.value.canvasEdgeAnimationEnabled && "animated"].filter(Boolean).join(" ");
  },
  focusable: false,
  selectable: false,
  updatable: false,
  interactionWidth: 40,
});
</script>

<style lang="scss" scoped>
.canvas {
  width: 100%;
  height: 100%;

  &.compositingEnabled :deep(.vue-flow__transformationpane) {
    will-change: transform;
  }

  &.handMode :deep(.vue-flow__transformationpane),
  &.handMode :deep(.vue-flow__transformationpane *) {
    pointer-events: none !important;
  }

  &.handMode :deep(.vue-flow__pane) {
    cursor: grab;
  }

  &.edgesHidden :deep(.vue-flow__edges) {
    display: none;
  }
  &.edgesHidden :deep(.vue-flow__handle) {
    display: none !important;
  }

  :deep(.vue-flow__edge.edgeActive .vue-flow__edge-path) {
    stroke: var(--canvasEdgeColor);
  }

  &:has(.selectionConnection) :deep(.vue-flow__node:not(.selected) .nodeHandle.target .handleIcon) {
    opacity: 1;
  }

  :deep(.vue-flow__nodesselection-rect) {
    box-sizing: content-box;
    padding: 8px;
    margin: -8px;
    border-radius: 4px;
  }
}
.edgeDisconnect {
  position: fixed;
  z-index: 1000;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translate(-50%, -50%);
}
</style>
