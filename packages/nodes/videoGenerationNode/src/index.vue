<template>
  <nodeSkeleton
    v-bind="nodeProps"
    v-model:bottomVisible="node.selected"
    :topVisible="node.selected"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    @fullscreen="player?.enterFullscreen()"
    :bottomWidth="660"
    :style="{ width: previewUrl && videoWidth ? `${videoWidth + 18}px` : undefined }">
    <template #topActions>
      <el-button :icon="IconMusic" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('extractAudio')">Extract audio track</el-button>
      <el-button :icon="IconLayersSubtract" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('separate')">Separate audio and video</el-button>
      <el-button :icon="IconScissors" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('trim')">Trim clip</el-button>
      <mediaHistory mediaType="video" :current="outputFile" :disabled="generating || deleting || uploading" @select="outputs.video = { dataType: 'VIDEO', value: $event }" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="generating || deleting" text title="Replace video" aria-label="Replace video" @click.stop="fileInput?.click()">Replace video</el-button>
      <input ref="fileInput" type="file" accept="video/*" hidden aria-label="Select replacement video" :disabled="generating || deleting || uploading" @change="replaceOutput" />
    </template>
    <template #topRightActions>
      <el-dropdown trigger="click" placement="bottom-end" :disabled="!player?.ready || player?.capturing || generating || deleting || uploading" @command="player?.captureFrame($event)">
        <el-button :icon="IconPhotoScan" :loading="player?.capturing" :disabled="!player?.ready || player?.capturing || generating || deleting || uploading" text title="Capture video frame" aria-label="Capture video frame" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="current" :icon="IconPhotoScan">Capture current frame</el-dropdown-item>
            <el-dropdown-item command="first" :icon="IconPlayerSkipBack">Capture first frame</el-dropdown-item>
            <el-dropdown-item command="last" :icon="IconPlayerSkipForward">Capture last frame</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <div v-loading="generating || uploading" class="videoContent nopan" :aria-busy="generating || uploading">
      <videoPlayer
        v-if="previewUrl"
        ref="player"
        :src="previewUrl"
        label="Generated video"
        @loadedmetadata="resizeVideo" />
      <div v-else class="videoEmpty" role="img" aria-label="No generated video yet">
        <icon-camera-ai :size="48" stroke="1.25" aria-hidden="true" />
      </div>
    </div>
    <template #bottom>
      <el-card class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <referenceItem
          v-if="refList.length"
          v-model="refList"
          @preview="setReferencePreview"
          @remove="removeReference" />
        <div v-if="frameMode" class="referenceHint">
          {{ selectedMode === "startFrameOptional" ? "With one image, it serves as the last frame; with two images, they serve as the first and last frames in order" : "Image references serve as the first and last frames in order" }}
        </div>
        <promptInput v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" expandable />
        <div class="promptFooter">
          <el-select
            v-model="data.model"
            class="modelSelect"
            filterable
            :loading="modelsLoading"
            :disabled="generating || deleting"
            placeholder="Select model"
            aria-label="Generation model"
            noDataText="Please add video models in settings first"
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
            v-model:duration="data.duration"
            v-model:resolution="data.resolution"
            v-model:ratio="data.ratio"
            v-model:mode="data.mode"
            v-model:generateAudio="data.generateAudio"
            :ratios="ratioOptions"
            :model="selectedModel"
            :disabled="generating || deleting || !selectedModel" />
          <el-button
            class="sendButton"
            :icon="generating ? IconPlayerStop : IconArrowUp"
            :disabled="deleting || uploading || (!generating && (!generationPrompt || !selectedModel))"
            :title="generating ? 'Stop generation' : 'Generate video'"
            :aria-label="generating ? 'Stop generation' : 'Generate video'"
            @click="generating ? generationController?.abort() : startGeneration().catch((error) => showNodeError(error, 'Video generation failed'))" />
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <videoActions ref="actions" :file="outputFile" :src="previewUrl" :disabled="generating || deleting || uploading" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from "vue";
import { ElButton, ElCard, ElSelect, ElOption, ElOptionGroup, ElLoading, ElDropdown, ElDropdownMenu, ElDropdownItem } from "element-plus";
import { IconCameraAi, IconSparkles, IconArrowUp, IconPlayerStop, IconTransfer, IconMusic, IconLayersSubtract, IconScissors, IconPhotoScan, IconPlayerSkipBack, IconPlayerSkipForward } from "@tabler/icons-vue";
import { groupNodeModels, nodeSkeleton, nodeTools, showNodeError, useNode, useNodeGeneration, useNodeReferences, z, type NodeMediaModel, type NodeVideoRequest, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import promptInput from "@toonflow/nodes-scaffold/promptInput";
import videoPlayer from "@toonflow/nodes-scaffold/videoPlayer";
import videoActions from "@toonflow/node-video/videoActions";
import referenceItem from "@toonflow/nodes-scaffold/referenceItem";
import mediaHistory from "@toonflow/nodes-scaffold/mediaHistory";
import generationSettings from "./components/generationSettings.vue";

defineOptions({
  inheritAttrs: false,
  icon: IconCameraAi,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "VIDEO", "AUDIO", "STRING"], label: "Image, video, audio, text input" },
    { id: "video", type: "source", dataType: "VIDEO", label: "Video output" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({
  label: "Video Generation",
});
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; model: string; duration?: number; resolution: string; ratio: string; mode: string; generateAudio: boolean });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.model ??= "";
data.value.resolution ??= "";
data.value.mode ??= "";
data.value.generateAudio ??= true;
data.value.ratio ??= "9:16";
const { refList, referenceMentions, setReferencePreview, removeReference } = useNodeReferences();
const models = ref<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
let disposed = false;
const deleting = ref(false);
const player = ref<InstanceType<typeof videoPlayer>>();
const actions = ref<InstanceType<typeof videoActions>>();
const videoWidth = ref(0);
let generationController: AbortController | undefined;
const generationState = useNodeGeneration(outputs, () => generationController?.abort());
const { generating } = generationState;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
// ACT: Providers do not declare video aspect ratio ranges; use the UI's general ratios, with specific support validated by the provider.
const ratioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const selectedModel = computed(() => models.value.find((item) => JSON.stringify([item.providerId, item.modelId]) === data.value.model));
const selectedMode = computed(() => selectedModel.value?.mode?.find((item) => JSON.stringify(item) === data.value.mode) as NodeVideoRequest["mode"]);
const frameMode = computed(() => ["startEndRequired", "endFrameOptional", "startFrameOptional"].includes(String(selectedMode.value)));
const mediaCounts = computed(() => ({
  image: refList.value.filter((item) => item.dataType === "IMAGE").length,
  video: refList.value.filter((item) => item.dataType === "VIDEO").length,
  audio: refList.value.filter((item) => item.dataType === "AUDIO").length,
}));
const matchingModes = computed(() => getMatchingModes(selectedModel.value));

function getMatchingModes(choice?: NodeMediaModel) {
  return (choice?.mode ?? []).filter((mode) => {
    const { image, video, audio } = mediaCounts.value;
    if (Array.isArray(mode)) return image + video + audio > 0 && Object.entries(mediaCounts.value).every(([type, count]) =>
      count <= Number(mode.find((item) => item.startsWith(`${type}Reference:`))?.split(":")[1] ?? 0)
    );
    if (mode === "text") return image + video + audio === 0;
    if (video || audio) return false;
    if (mode === "singleImage") return image === 1;
    if (mode === "startEndRequired") return image === 2;
    return ["endFrameOptional", "startFrameOptional"].includes(mode) && image >= 1 && image <= 2;
  });
}

function getDurations(choice: NodeMediaModel) {
  return [...new Set((choice.durationResolutionMap ?? []).flatMap((item) => item.duration))].sort((a, b) => a - b);
}

function getResolutions(choice: NodeMediaModel, duration?: number) {
  // ACT: Video resolutions currently use the p unit; normalize conversions when other units appear.
  return [...new Set((choice.durationResolutionMap ?? []).filter((item) => item.duration.includes(duration!)).flatMap((item) => item.resolution))]
    .sort((left, right) => (Number.parseFloat(left) || Infinity) - (Number.parseFloat(right) || Infinity));
}
// ACT: When references change, only replace inapplicable modes; prefer regular media as references to avoid auto-becoming start/end frames.
watch([selectedModel, matchingModes, () => data.value.mode], ([choice, matches]) => {
  if (!choice || matches.some((item) => JSON.stringify(item) === data.value.mode)) return;
  const modes = choice.mode ?? [];
  const mode = matches.find(Array.isArray) ?? matches.find((item) => item === "singleImage")
    ?? matches.find((item) => item === "endFrameOptional") ?? matches[0]
    ?? modes.find((item) => JSON.stringify(item) === data.value.mode) ?? modes.find(Array.isArray) ?? modes[0];
  data.value.mode = mode === undefined ? "" : JSON.stringify(mode);
}, { flush: "sync" });
// ACT: Parameters are normalized within the node; Agent can generate directly even when the node is not selected or the bottom settings are not mounted.
watch([selectedModel, () => data.value.duration], ([choice]) => {
  if (!choice) return;
  const durations = getDurations(choice);
  if (!durations.includes(data.value.duration!)) data.value.duration = durations[0];
  const resolutions = getResolutions(choice, data.value.duration);
  if (!resolutions.includes(data.value.resolution)) data.value.resolution = resolutions[0] ?? "";
  if (!ratioOptions.includes(data.value.ratio)) data.value.ratio = "9:16";
  if (choice.audio !== "optional") data.value.generateAudio = choice.audio === true;
}, { flush: "sync" });
const modelGroups = computed(() => groupNodeModels(models.value));
const generationPrompt = computed(() =>
  [
    data.value.prompt.trim(),
    ...refList.value.flatMap((item, index) => (item.dataType === "STRING" && item.value?.trim() ? [`Reference ${index + 1}:\n${item.value.trim()}`] : [])),
  ]
    .filter(Boolean)
    .join("\n\n")
);
const outputFile = computed(() => outputs.value.video?.dataType === "VIDEO" ? outputs.value.video.value : undefined);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showNodeError(error, "Failed to load video")
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
  if (!file.type.startsWith("video/")) return void showNodeError("Please select a video file", "Failed to replace video");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Video cannot be empty and must not exceed 100 MB", "Failed to replace video");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: Keep historical output files to avoid breaking undo history and copied node references.
    outputs.value.video = { dataType: "VIDEO", value: { url, mimeType: file.type } };
  } catch (error) {
    showNodeError(error, "Video replacement failed");
  } finally {
    uploading.value = false;
  }
}

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then((items) => {
    if (generating.value || deleting.value) return;
    models.value = items.filter((item) => item.type === "video");
    // ACT: Only select default model for empty config; keep unavailable old selection and its parameters.
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

async function startGeneration() {
  const choice = selectedModel.value;
  if (generating.value) throw new Error("Video is generating, please wait");
  if (uploading.value) throw new Error("Video is being replaced, please wait");
  if (deleting.value) throw new Error("Node is being deleted");
  if (!choice) throw new Error("Please select a video model first");
  if (!generationPrompt.value) throw new Error("Please enter a generation prompt");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Referenced node has no content yet, please add content first");
  const images = refList.value.flatMap((item) => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []);
  if (choice.mode?.length && !matchingModes.value.length) throw new Error("The current model has no generation mode suitable for these reference materials, please switch models or adjust references");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  const input: Omit<NodeVideoRequest, "directory"> = {
    providerId: choice.providerId,
    modelId: choice.modelId,
    prompt: generationPrompt.value,
    mode: selectedMode.value,
    duration: data.value.duration,
    resolution: data.value.resolution || undefined,
    ratio: data.value.ratio,
    generateAudio: choice.audio === "optional" ? data.value.generateAudio : choice.audio,
    outputDirectory: `assets/${id}`,
    images: frameMode.value ? undefined : images,
    firstFrame: frameMode.value && (selectedMode.value !== "startFrameOptional" || images.length > 1) ? images[0] : undefined,
    lastFrame: frameMode.value ? images[selectedMode.value === "startFrameOptional" && images.length === 1 ? 0 : 1] : undefined,
    videos: refList.value.flatMap((item) => item.dataType === "VIDEO" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
    audios: refList.value.flatMap((item) => item.dataType === "AUDIO" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
  };
  generationController = controller;
  // ACT: The tool returns immediately; the task is owned by the node and cancelled on stop or unmount.
  generation = generationState.run(() => workspace
    .list()
    .then(({ directory }) => {
      controller.signal.throwIfAborted();
      return ai.generateVideo({ ...input, directory }, controller.signal);
    })
    .then(([result]) => {
      controller.signal.throwIfAborted();
      if (!result) throw new Error("The provider returned no video");
      outputs.value.video = { dataType: "VIDEO", value: { url: result.path, mimeType: result.mimeType } };
    }))
    .catch((error) => showNodeError(error, "Video generation failed"))
    .finally(() => {
      generationController = undefined;
    });
  return { status: "generating" };
}

nodeEvent.on("save", (reason) => {
  if (reason === "reload" && (generating.value || uploading.value || deleting.value)) throw new Error("Video is being processed, please reload the node after it finishes");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Video is being replaced, please delete the node later");
  deleting.value = true;
  generationController?.abort();
  try {
    await generation;
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

async function resizeVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (!video.videoWidth || !video.videoHeight) return;
  videoWidth.value = Math.max(180, (240 * video.videoWidth) / video.videoHeight);
  await nextTick();
  updateNodeInternals();
}

function getConfig() {
  return {
    config: {
      providerId: selectedModel.value?.providerId ?? "",
      modelId: selectedModel.value?.modelId ?? "",
      duration: data.value.duration,
      resolution: data.value.resolution,
      ratio: data.value.ratio,
      mode: selectedMode.value,
      generateAudio: data.value.generateAudio,
    },
    models: models.value,
    ratios: ratioOptions,
    matchingModes: matchingModes.value,
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Read the current configuration of this video generation node, available video model capabilities, common ratios, and modes suitable for the current references, without secrets; duration and resolution must conform to durationResolutionMap",
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
  description: "Change the model, duration, resolution, ratio, mode, or audio of this video generation node; query capabilities with getConfig first; providerId and modelId must be provided together; mode uses the original string or array returned and must match the current references; does not change the prompt or start generation",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    duration: z.number().positive().optional(),
    resolution: z.string().min(1).optional(),
    ratio: z.enum(ratioOptions).optional(),
    mode: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    generateAudio: z.boolean().optional(),
  }).refine((args) => (args.providerId === undefined) === (args.modelId === undefined), "providerId and modelId must be provided together"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node is generating or being deleted, please change the configuration later");
    await loadModels();
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node is generating or being deleted, please change the configuration later");
    const choice = args.modelId === undefined ? selectedModel.value
      : models.value.find((item) => item.providerId === args.providerId && item.modelId === args.modelId);
    if (!choice) throw new Error("Please select a valid video model returned by getConfig");
    const durations = getDurations(choice);
    if (args.duration !== undefined && !durations.includes(args.duration)) throw new Error(`The current model does not support duration ${args.duration}, available: ${durations.join(", ")}`);
    const duration = args.duration ?? (durations.includes(data.value.duration!) ? data.value.duration : durations[0]);
    const resolutions = getResolutions(choice, duration);
    if (args.resolution !== undefined && !resolutions.includes(args.resolution)) throw new Error(`The current duration does not support resolution ${args.resolution}, available: ${resolutions.join(", ")}`);
    const resolution = args.resolution ?? (resolutions.includes(data.value.resolution) ? data.value.resolution : resolutions[0] ?? "");
    if (args.mode !== undefined && !getMatchingModes(choice).some((item) => JSON.stringify(item) === JSON.stringify(args.mode))) throw new Error("The selected mode is not supported by the current model or does not apply to the current references, please choose according to model capabilities and connected materials");
    if (args.generateAudio !== undefined && choice.audio !== "optional" && args.generateAudio !== (choice.audio === true)) throw new Error("The current model does not support toggling audio, see the audio capability returned by getConfig");
    data.value.model = JSON.stringify([choice.providerId, choice.modelId]);
    data.value.duration = duration;
    data.value.resolution = resolution;
    if (args.ratio !== undefined) data.value.ratio = args.ratio;
    if (args.mode !== undefined) data.value.mode = JSON.stringify(args.mode);
    if (args.generateAudio !== undefined) data.value.generateAudio = args.generateAudio;
    return getConfig();
  },
});

nodeTools.register({
  name: "setPrompt",
  description: "Change the video generation prompt of this node, supporting reference markers such as {{ref 1}}; only changes the prompt and does not start generation",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt: value }) {
    if (deleting.value) throw new Error("Node is being deleted, please change it later");
    data.value.prompt = value;
    data.value.promptModel = value.split("\n").map((text) => [{ type: "Write", text }]);
    return { prompt: value };
  },
});

nodeTools.register({
  name: "generateVideo",
  description: "Start background video generation for this node using the current prompt, model, mode, duration, resolution, ratio, and reference materials; returns immediately once started, use getGenerationStatus to query the result and cancelGeneration to stop generation",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.videoContent {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 144px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .videoEmpty {
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
  .referenceHint {
    margin: 8px 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

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
