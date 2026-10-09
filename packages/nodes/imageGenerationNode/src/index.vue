<template>
  <nodeSkeleton
    v-bind="nodeProps"
    v-model:bottomVisible="node.selected"
    :topVisible="node.selected"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    @fullscreen="previewVisible = true"
    :bottomWidth="660"
    :style="{ width: previewUrl && imageWidth ? `${imageWidth + 18}px` : undefined }">
    <template v-if="editor?.mode" #top><div ref="paintToolbar" /></template>
    <template #topActions>
      <el-button :icon="IconBrush" :disabled="generating || deleting || uploading || !previewUrl || gridSplit?.splitting" text title="Inpaint" aria-label="Inpaint" @click.stop="editor?.start('inpaint')">Inpaint</el-button>
      <el-button :icon="IconLayoutGrid" :disabled="generating || deleting || uploading || !previewUrl" :loading="gridSplit?.splitting" text title="Grid split" aria-label="Grid split" @click.stop="gridSplit?.open($event)">Grid split</el-button>
      <mediaHistory mediaType="image" :current="outputFile" :disabled="generating || deleting || uploading" @select="outputs.image = { dataType: 'IMAGE', value: $event }" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="generating || deleting" text title="Replace image" aria-label="Replace image" @click.stop="fileInput?.click()">Replace image</el-button>
      <input ref="fileInput" type="file" accept="image/*" hidden aria-label="Select replacement image" :disabled="generating || deleting || uploading" @change="replaceOutput" />
    </template>
    <template #topRightActions>
      <el-button :icon="IconPencil" :disabled="generating || deleting || uploading || !previewUrl || gridSplit?.splitting" text title="Mark" aria-label="Mark" @click.stop="editor?.start('mark')" />
    </template>
    <div v-loading="generating || uploading" class="imageContent nopan" :aria-busy="generating || uploading">
      <imageEditor
        v-if="previewUrl"
        ref="editor"
        :src="previewUrl"
        :toolbarTarget="paintToolbar"
        :disabled="generating || deleting || uploading"
        alt="Generated image"
        @load="resizeImage"
        @error="showNodeError('Cannot preview this image', 'Image preview failed')" />
      <div v-else class="imageEmpty" role="img" aria-label="No generated image yet">
        <icon-photo-ai :size="48" stroke="1.25" aria-hidden="true" />
      </div>
    </div>
    <template v-if="editor?.mode !== 'mark'" #bottom>
      <el-card class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <referenceItem
          v-if="refList.length"
          v-model="refList"
          @preview="setReferencePreview"
          @remove="removeReference" />
        <promptInput v-if="editor?.mode === 'inpaint'" v-model="data.inpaintPromptModel" v-model:text="data.inpaintPrompt" :references="referenceMentions" expandable />
        <promptInput v-else v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" expandable />
        <div class="promptFooter">
          <el-select
            v-model="data.model"
            class="modelSelect"
            filterable
            :loading="modelsLoading"
            :disabled="generating || deleting"
            placeholder="Select model"
            aria-label="Generation model"
            noDataText="Please add image models in settings first"
            placement="top-start"
            @visible-change="(visible) => visible && loadModels().catch((error) => showNodeError(error, 'Failed to load models'))">
            <template #prefix><icon-sparkles :size="17" /></template>
            <el-option-group v-for="provider in modelGroups" :key="provider.id" :label="provider.label">
              <el-option
                v-for="item in provider.models"
                :key="item.modelId"
                :label="item.label"
                :value="JSON.stringify([item.providerId, item.modelId])" />
            </el-option-group>
          </el-select>
          <generationSettings
            v-model:size="data.size"
            v-model:ratio="data.ratio"
            :sizes="sizeOptions"
            :ratios="ratioOptions"
            :disabled="generating || deleting || !selectedModel" />
          <el-button
            class="sendButton"
            :icon="generating ? IconPlayerStop : IconArrowUp"
            :disabled="deleting || uploading || (!generating && (editor?.busy || !generationPrompt || !selectedModel))"
            :title="generating ? 'Stop generation' : editor?.mode === 'inpaint' ? 'Inpaint' : 'Generate image'"
            :aria-label="generating ? 'Stop generation' : editor?.mode === 'inpaint' ? 'Inpaint' : 'Generate image'"
            @click="generating ? generationController?.abort() : startGeneration(editor?.mode === 'inpaint').catch((error) => showNodeError(error, 'Image generation failed'))" />
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <imageGridSplit ref="gridSplit" :src="previewUrl" :disabled="generating || deleting || uploading" :active="node.selected" />
  <el-image-viewer
    v-if="previewVisible && previewUrl"
    :urlList="[previewUrl]"
    teleported
    @close="previewVisible = false" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from "vue";
import { ElButton, ElCard, ElSelect, ElOption, ElOptionGroup, ElLoading, ElImageViewer } from "element-plus";
import { IconPhotoAi, IconSparkles, IconArrowUp, IconPlayerStop, IconTransfer, IconLayoutGrid, IconBrush, IconPencil } from "@tabler/icons-vue";
import { groupNodeModels, nodeSkeleton, nodeTools, showNodeError, useNode, useNodeGeneration, useNodeReferences, z, type NodeMediaModel, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import promptInput from "@toonflow/nodes-scaffold/promptInput";
import referenceItem from "@toonflow/nodes-scaffold/referenceItem";
import mediaHistory from "@toonflow/nodes-scaffold/mediaHistory";
import imageGridSplit from "@toonflow/nodes-scaffold/imageGridSplit";
import imageEditor from "@toonflow/nodes-scaffold/imageEditor";
import generationSettings from "./components/generationSettings.vue";

defineOptions({
  inheritAttrs: false,
  icon: IconPhotoAi,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "STRING"], label: "Image and text input" },
    { id: "image", type: "source", dataType: "IMAGE", label: "Image output" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({
  label: "Image Generation",
});
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; inpaintPrompt: string; inpaintPromptModel: PromptModel; model: string; size: string; ratio: string });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.inpaintPrompt ??= "";
data.value.inpaintPromptModel ??= [];
data.value.model ??= "";
data.value.size ??= "";
data.value.ratio ??= "16:9";
const { refList, referenceMentions, setReferencePreview, removeReference } = useNodeReferences();
const models = ref<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
const gridSplit = ref<InstanceType<typeof imageGridSplit>>();
const editor = ref<InstanceType<typeof imageEditor>>();
const paintToolbar = ref<HTMLElement>();
let disposed = false;
const deleting = ref(false);
const previewVisible = ref(false);
const imageWidth = ref(0);
let generationController: AbortController | undefined;
const generationState = useNodeGeneration(outputs, () => generationController?.abort());
const { generating } = generationState;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
const selectedModel = computed(() => models.value.find((item) => JSON.stringify([item.providerId, item.modelId]) === data.value.model));
const sizeOptions = computed(() => (selectedModel.value?.imageSizes?.length ? selectedModel.value.imageSizes : ["2K"]));
const ratioOptions = computed(() => (selectedModel.value?.imageRatios?.length ? selectedModel.value.imageRatios : ["16:9"]));
watch(
  selectedModel,
  (choice) => {
    if (!choice) return;
    // ACT: Current resolutions use K units; convert uniformly when other units appear. Unknown names sort after numeric options.
    if (!sizeOptions.value.includes(data.value.size)) data.value.size = sizeOptions.value.toSorted((left, right) =>
      (Number.parseFloat(left) || Infinity) - (Number.parseFloat(right) || Infinity)
    )[0]!;
    if (!ratioOptions.value.includes(data.value.ratio)) data.value.ratio = ratioOptions.value.includes("16:9") ? "16:9" : ratioOptions.value[0]!;
  },
  { flush: "sync" }
);
const modelGroups = computed(() => groupNodeModels(models.value));
const generationPrompt = computed(() =>
  [
    (editor.value?.mode === "inpaint" ? data.value.inpaintPrompt : data.value.prompt).trim(),
    ...refList.value.flatMap((item, index) => (item.dataType === "STRING" && item.value?.trim() ? [`Reference ${index + 1}:\n${item.value.trim()}`] : [])),
  ]
    .filter(Boolean)
    .join("\n\n")
);
const outputFile = computed(() => outputs.value.image?.dataType === "IMAGE" ? outputs.value.image.value : undefined);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showNodeError(error, "Image read failed")
);

onMounted(() => loadModels().catch((error) => showNodeError(error, "Failed to load models")));
onScopeDispose(() => {
  disposed = true;
  generationController?.abort();
});

async function replaceOutput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || generating.value || deleting.value || uploading.value || disposed) return;
  if (!file.type.startsWith("image/")) return void showNodeError("Please select an image file", "Image replacement failed");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Image cannot be empty and cannot exceed 100 MB", "Image replacement failed");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: Keep historical output files to avoid breaking undo history and copied node references.
    outputs.value.image = { dataType: "IMAGE", value: { url, mimeType: file.type } };
  } catch (error) {
    showNodeError(error, "Image replacement failed");
  } finally {
    uploading.value = false;
  }
}

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then((items) => {
    if (generating.value || deleting.value) return;
    models.value = items.filter((item) => item.type === "image");
    // ACT: Only select a default model for empty config; preserve temporarily unavailable old selections and their parameters.
    if (!data.value.model) {
      const first = models.value[0];
      data.value.model = first ? JSON.stringify([first.providerId, first.modelId]) : "";
    }
  }).finally(() => {
    modelsLoading.value = false;
    modelsRequest = undefined;
  });
  return modelsRequest;
}

async function startGeneration(inpaint = false) {
  const choice = selectedModel.value;
  if (generating.value) throw new Error("Image generation in progress, please wait");
  if (uploading.value) throw new Error("Image replacement in progress, please wait");
  if (deleting.value) throw new Error("Node is being deleted");
  if (editor.value?.busy || editor.value?.mode === "mark") throw new Error("Please finish marking the image first");
  const inpaintEditor = editor.value?.mode === "inpaint" ? editor.value : undefined;
  if (inpaint !== !!inpaintEditor) throw new Error(inpaint ? "Enter inpaint mode first" : "Please exit inpaint mode before starting normal image generation");
  if (!choice) throw new Error("Please select an image model first");
  if (!generationPrompt.value) throw new Error("Please enter a generation prompt");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Referenced nodes have no content yet, please add reference content first");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  const input = {
    providerId: choice.providerId,
    modelId: choice.modelId,
    prompt: generationPrompt.value,
    size: data.value.size,
    ratio: data.value.ratio,
    outputDirectory: `assets/${id}`,
    images: refList.value.flatMap((item) => (item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : [])),
  };
  generationController = controller;
  if (inpaintEditor) {
    const imageReferences = refList.value.flatMap((item, index) => item.dataType === "IMAGE" && item.value ? [index + 1] : []);
    if (imageReferences.length) input.prompt += `\nReference number mapping (first two are original and region guide): ${imageReferences.map((reference, index) => `Reference ${reference} / {{ref ${reference}}} corresponds to image ${index + 3}`).join("; ")}.`;
  }
  // ACT: Tool returns immediately; task is held by the node, cancelled on stop or unmount.
  generation = generationState.run(() => inpaintEditor
    ? inpaintEditor.generate(input, controller.signal).then(value => {
      controller.signal.throwIfAborted();
      outputs.value.image = { dataType: "IMAGE", value };
      inpaintEditor.cancel();
    })
    : workspace
    .list()
    .then(({ directory }) => {
      controller.signal.throwIfAborted();
      return ai.generateImage({ ...input, directory }, controller.signal);
    })
    .then(([result]) => {
      controller.signal.throwIfAborted();
      if (!result) throw new Error("Provider returned no image");
      outputs.value.image = { dataType: "IMAGE", value: { url: result.path, mimeType: result.mimeType } };
    }))
    .catch((error) => showNodeError(error, "Image generation failed"))
    .finally(() => {
      generationController = undefined;
    });
  return { status: "generating" };
}

nodeEvent.on("save", (reason) => {
  if (reason === "reload" && (generating.value || uploading.value || deleting.value || editor.value?.busy)) throw new Error("Image processing in progress, please finish before refreshing the node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value || (editor.value?.busy && !generating.value)) throw new Error("Image processing in progress, please delete the node later");
  deleting.value = true;
  generationController?.abort();
  try {
    await generation;
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

async function resizeImage(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  if (!image.naturalWidth || !image.naturalHeight) return;
  imageWidth.value = (240 * image.naturalWidth) / image.naturalHeight;
  await nextTick();
  updateNodeInternals();
}

function getConfig() {
  return {
    config: {
      providerId: selectedModel.value?.providerId ?? "",
      modelId: selectedModel.value?.modelId ?? "",
      size: data.value.size,
      ratio: data.value.ratio,
    },
    models: models.value,
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Read this image generation node's current model, resolution, ratio, and available image model capabilities (no secrets); defaults to 2K resolution and 16:9 ratio when unspecified",
  parameters: z.strictObject({}),
  async execute(_args, { signal }) {
    signal?.throwIfAborted();
    await loadModels();
    signal?.throwIfAborted();
    return getConfig();
  },
});

nodeTools.register({
  name: "setConfig",
  description: "Modify this image generation node's model, resolution, or ratio; use getConfig first to query available capabilities. providerId and modelId must be provided together; does not modify the prompt or start generation",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    ratio: z.string().min(1).optional(),
  }).refine((args) => (args.providerId === undefined) === (args.modelId === undefined), "providerId and modelId must be provided together"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node is generating or being deleted, please modify config later");
    await loadModels();
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node is generating or being deleted, please modify config later");
    const choice = args.modelId === undefined ? selectedModel.value
      : models.value.find((item) => item.providerId === args.providerId && item.modelId === args.modelId);
    if (!choice) throw new Error("Please select a valid image model from getConfig results");
    const sizes = choice.imageSizes?.length ? choice.imageSizes : ["2K"];
    const ratios = choice.imageRatios?.length ? choice.imageRatios : ["16:9"];
    if (args.size !== undefined && !sizes.includes(args.size)) throw new Error(`Current model does not support resolution ${args.size}, available: ${sizes.join(", ")}`);
    if (args.ratio !== undefined && !ratios.includes(args.ratio)) throw new Error(`Current model does not support ratio ${args.ratio}, available: ${ratios.join(", ")}`);
    data.value.model = JSON.stringify([choice.providerId, choice.modelId]);
    if (args.size !== undefined) data.value.size = args.size;
    if (args.ratio !== undefined) data.value.ratio = args.ratio;
    return getConfig();
  },
});

nodeTools.register({
  name: "setPrompt",
  description: "Modify this node's normal image generation prompt, supports {{ref 1}} reference markers; does not modify the inpaint prompt or start generation",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt: value }) {
    if (deleting.value) throw new Error("Node is being deleted, please modify later");
    data.value.prompt = value;
    data.value.promptModel = value.split("\n").map((text) => [{ type: "Write", text }]);
    return { prompt: value };
  },
});

nodeTools.register({
  name: "generateImage",
  description: "Start this node's background normal image generation using the normal prompt, model, resolution, ratio, and reference images; must exit inpaint mode first. Returns immediately once started; use getGenerationStatus to query completion, cancelGeneration to stop",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.imageContent {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 144px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .imageEmpty {
    display: grid;
    place-items: center;
    min-height: 144px;
    color: var(--el-text-color-placeholder);
  }

  :deep(.el-loading-mask) {
    pointer-events: none;
  }

}

.promptCard {
  .promptFooter {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;

    .modelSelect {
      width: 190px;
      min-width: 0;

      &:deep(.el-select__wrapper) {
        gap: 6px;
        padding: 0;
        box-shadow: none;
        background: transparent;
      }
    }

    .sendButton {
      width: 32px;
      height: 32px;
      margin-left: auto;
      padding: 0;
      --el-button-bg-color: var(--el-text-color-primary);
      --el-button-border-color: transparent;
      --el-button-text-color: var(--el-bg-color);
      --el-button-hover-bg-color: var(--el-text-color-regular);
      --el-button-hover-border-color: transparent;
      --el-button-hover-text-color: var(--el-bg-color);
    }
  }
}
</style>
