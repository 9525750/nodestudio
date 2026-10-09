<template>
  <nodeSkeleton
    v-bind="nodeProps"
    :topVisible="node.selected"
    :bottomVisible="node.selected"
    :bottomWidth="actions?.mode === 'speed' ? 440 : 660"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    :fullscreenVisible="false"
    style="width: 360px">
    <template #topActions>
      <el-button :icon="IconScissors" :disabled="busy || !previewUrl" text title="Clip audio" aria-label="Clip audio" @click.stop="actions?.open('clip')">Clip</el-button>
      <el-button :icon="IconGauge" :disabled="busy || !previewUrl" text title="Speed change" aria-label="Speed change" @click.stop="actions?.open('speed')">Speed</el-button>
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="busy" text title="Replace audio" aria-label="Replace audio" @click.stop="fileInput?.click()">Replace audio</el-button>
      <input ref="fileInput" type="file" accept="audio/*" hidden aria-label="Select replacement audio" :disabled="busy" @change="replaceOutput" />
    </template>
    <div v-loading="generating || uploading" class="audioContent nopan" :aria-busy="generating || uploading">
      <audioPlayer v-if="previewUrl" ref="player" class="audioPreview" :src="previewUrl" @loadedmetadata="updateNodeInternals" />
      <div v-else class="audioEmpty" role="img" aria-label="No generated audio yet"><icon-music-bolt :size="48" stroke="1.25" aria-hidden="true" /></div>
    </div>
    <template #bottom>
      <div v-if="actions?.mode === 'speed'" ref="speedTarget" />
      <el-card v-else class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <referenceItem v-if="refList.length" v-model="refList" @preview="setReferencePreview" @remove="removeReference" />
        <promptInput v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" placeholder="Describe the audio you want or enter text to be read aloud" expandable />
        <div class="promptFooter">
          <el-select
            v-model="data.model"
            class="modelSelect"
            filterable
            :loading="modelsLoading"
            :disabled="busy"
            placeholder="Select model"
            aria-label="Audio generation model"
            noDataText="Please add audio models in settings first"
            placement="top-start"
            @visible-change="visible => visible && loadModels().catch(error => showNodeError(error, 'Failed to load models'))">
            <template #prefix><icon-music-bolt :size="17" /></template>
            <el-option-group v-for="provider in modelGroups" :key="provider.id" :label="provider.label">
              <el-option v-for="item in provider.models" :key="item.modelId" :label="item.label" :value="JSON.stringify([item.providerId, item.modelId])" />
            </el-option-group>
          </el-select>
          <generationSettings v-model:language="data.language" v-model:sampleRate="data.sampleRate" v-model:format="data.format" :disabled="busy || !selectedModel" />
          <el-button
            class="sendButton"
            :icon="generating ? IconPlayerStop : IconArrowUp"
            :disabled="deleting || uploading || actions?.processing || (!generating && (!generationPrompt || !selectedModel))"
            :title="generating ? 'Stop generation' : 'Generate audio'"
            :aria-label="generating ? 'Stop generation' : 'Generate audio'"
            @click="generating ? generationController?.abort() : startGeneration().catch(error => showNodeError(error, 'Audio generation failed'))" />
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <audioActions ref="actions" :file="outputFile" :src="previewUrl" :target="speedTarget" :disabled="generating || deleting || uploading" @pause="player?.pause()" />
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from "vue";
import { ElButton, ElCard, ElLoading, ElOption, ElOptionGroup, ElSelect } from "element-plus";
import { IconArrowUp, IconGauge, IconMusicBolt, IconPlayerStop, IconScissors, IconTransfer } from "@tabler/icons-vue";
import { getTargetValues, groupNodeModels, isTypeCompatible, nodeSkeleton, nodeTools, showNodeError, useNode, useNodeGeneration, useNodeReferences, z, type NodeAudioRequest, type NodeHandle, type NodeInputValue, type NodeMediaModel } from "@toonflow/nodes-scaffold/runtime";
import audioPlayer from "@toonflow/node-audio/audioPlayer";
import audioActions from "@toonflow/node-audio/audioActions";
import promptInput from "@toonflow/nodes-scaffold/promptInput";
import referenceItem from "@toonflow/nodes-scaffold/referenceItem";
import generationSettings from "./components/generationSettings.vue";
import { formatOptions, languageOptions, sampleRateOptions } from "./audioSettings";

defineOptions({
  inheritAttrs: false,
  icon: IconMusicBolt,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "AUDIO", "STRING"], label: "Image or audio limited to 1, text unlimited" },
    { id: "audio", type: "source", dataType: "AUDIO", label: "Audio output" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({ label: "Audio Generation" });
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; model: string; language: string; sampleRate: number; format: string });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.model ??= "";
data.value.language ??= "zh-CN";
data.value.sampleRate ??= 24000;
data.value.format ??= "wav";
const { refList, referenceMentions, setReferencePreview, removeReference } = useNodeReferences();
const models = ref<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const deleting = ref(false);
const fileInput = ref<HTMLInputElement>();
const player = ref<InstanceType<typeof audioPlayer>>();
const actions = ref<InstanceType<typeof audioActions>>();
const speedTarget = ref<HTMLElement>();
let disposed = false;
let generationController: AbortController | undefined;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
const generationState = useNodeGeneration(outputs, () => generationController?.abort());
const { generating } = generationState;
const busy = computed(() => generating.value || uploading.value || deleting.value || !!actions.value?.processing);
const selectedModel = computed(() => models.value.find(item => JSON.stringify([item.providerId, item.modelId]) === data.value.model));
const modelGroups = computed(() => groupNodeModels(models.value));
const generationPrompt = computed(() => [data.value.prompt.trim(), ...refList.value.flatMap((item, index) =>
  item.dataType === "STRING" && item.value?.trim() ? [`Reference ${index + 1}:\n${item.value.trim()}`] : [])].filter(Boolean).join("\n\n"));
const outputFile = computed(() => outputs.value.audio?.dataType === "AUDIO" ? outputs.value.audio.value : undefined);
const previewUrl = files.useFileUrl(outputFile, error => showNodeError(error, "Failed to read audio"));

function referencesAllowed(values: NodeInputValue[]) {
  return values.filter(item => isTypeCompatible(item.dataType, ["IMAGE", "AUDIO"])).length <= 1;
}

nodeEvent.on("canConnect", (connection, context) => {
  // ACT: Re-validating existing edges does not double-count; sources that have not produced content still occupy their declared type slot.
  const edges = context.edges.filter(edge => edge.source !== connection.source || edge.sourceHandle !== connection.sourceHandle
    || edge.target !== connection.target || edge.targetHandle !== connection.targetHandle);
  return referencesAllowed(getTargetValues(id, "in", context.nodes, [...edges, connection]));
});

onMounted(() => loadModels().catch(error => showNodeError(error, "Failed to load models")));
onScopeDispose(() => {
  disposed = true;
  generationController?.abort();
});

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then(items => {
    if (disposed || busy.value) return;
    models.value = items.filter(item => item.type === "audio");
    // ACT: Only pick the default model when config is empty; temporarily unavailable models keep their selection to avoid silently switching providers.
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
  if (busy.value || disposed) throw new Error("Audio is processing or node is closed, please try again later");
  const choice = selectedModel.value;
  if (!choice) throw new Error("Please select an audio model first");
  if (!generationPrompt.value) throw new Error("Please enter a generation prompt or text to read aloud");
  if (!referencesAllowed(refList.value)) throw new Error("Image and audio cannot be referenced simultaneously, and at most one total; text has no limit");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Referenced node has no content yet, please provide the referenced content first");
  if (!languageOptions.some(item => item.value === data.value.language) || !sampleRateOptions.includes(data.value.sampleRate) || !formatOptions.includes(data.value.format)) throw new Error("Please select a valid language, sample rate, and output format");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  const input: Omit<NodeAudioRequest, "directory"> = {
    providerId: choice.providerId,
    modelId: choice.modelId,
    prompt: generationPrompt.value,
    language: data.value.language,
    sampleRate: data.value.sampleRate,
    format: data.value.format,
    outputDirectory: `assets/${id}`,
    images: refList.value.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
    audios: refList.value.flatMap(item => item.dataType === "AUDIO" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
  };
  generationController = controller;
  generation = generationState.run(async () => {
    const { directory } = await workspace.list();
    controller.signal.throwIfAborted();
    const [result] = await ai.generateAudio({ ...input, directory }, controller.signal);
    controller.signal.throwIfAborted();
    if (!result) throw new Error("Provider did not return audio");
    outputs.value.audio = { dataType: "AUDIO", value: { url: result.path, mimeType: result.mimeType } };
  }).catch(error => showNodeError(error, "Audio generation failed")).finally(() => {
    generationController = undefined;
  });
  return { status: "generating" };
}

async function replaceOutput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value || disposed) return;
  if (!file.type.startsWith("audio/")) return void showNodeError("Please select an audio file", "Failed to replace audio");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Audio cannot be empty and cannot exceed 100 MB", "Failed to replace audio");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: Replace does not delete old audio; preserves file references from copied nodes and undo history.
    outputs.value.audio = { dataType: "AUDIO", value: { url, mimeType: file.type } };
  } catch (error) {
    showNodeError(error, "Failed to replace audio");
  } finally {
    uploading.value = false;
  }
}

nodeEvent.on("save", reason => {
  if (uploading.value || (reason === "reload" && busy.value)) throw new Error("Audio is processing, please finish or cancel before refreshing the node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Audio is being replaced, please try deleting the node later");
  deleting.value = true;
  generationController?.abort();
  try {
    await Promise.all([generation, actions.value?.cancelAndWait()]);
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

function getConfig() {
  return {
    config: { providerId: selectedModel.value?.providerId ?? "", modelId: selectedModel.value?.modelId ?? "", language: data.value.language, sampleRate: data.value.sampleRate, format: data.value.format },
    models: models.value,
    languages: languageOptions,
    sampleRates: sampleRateOptions,
    formats: formatOptions,
    inputLimits: { text: "unlimited", imageOrAudio: 1 },
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Read this audio generation node's config, available audio models, languages, sample rates, output formats and input limits (no secrets); text unlimited, image and audio are mutually exclusive with at most one total, specific model capabilities are verified by the provider",
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
  description: "Modify audio generation model, language, sample rate or format; use getConfig to query options first, providerId and modelId must be provided together; does not modify prompt or start generation",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    language: z.string().optional(),
    sampleRate: z.number().int().positive().optional(),
    format: z.string().optional(),
  }).refine(args => (args.providerId === undefined) === (args.modelId === undefined), "providerId and modelId must be provided together"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (busy.value || disposed) throw new Error("Audio is processing or node is closed, please try modifying config later");
    await loadModels();
    signal?.throwIfAborted();
    if (busy.value || disposed) throw new Error("Audio is processing or node is closed, please try modifying config later");
    const choice = args.modelId === undefined ? selectedModel.value : models.value.find(item => item.providerId === args.providerId && item.modelId === args.modelId);
    if (!choice) throw new Error("Please select a valid audio model from getConfig results");
    if (args.language !== undefined && !languageOptions.some(item => item.value === args.language)) throw new Error("Please select a valid language from getConfig results");
    if (args.sampleRate !== undefined && !sampleRateOptions.includes(args.sampleRate)) throw new Error("Please select a valid sample rate from getConfig results");
    if (args.format !== undefined && !formatOptions.includes(args.format)) throw new Error("Please select a valid output format from getConfig results");
    data.value.model = JSON.stringify([choice.providerId, choice.modelId]);
    if (args.language !== undefined) data.value.language = args.language;
    if (args.sampleRate !== undefined) data.value.sampleRate = args.sampleRate;
    if (args.format !== undefined) data.value.format = args.format;
    return getConfig();
  },
});
nodeTools.register({
  name: "setPrompt",
  description: "Modify this node's audio generation prompt or text to read aloud, supports {{ref 1}} reference markers; only modifies text, does not start generation",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt }) {
    if (deleting.value || disposed) throw new Error("Node is being deleted or is closed, please try modifying later");
    data.value.prompt = prompt;
    data.value.promptModel = prompt.split("\n").map(text => [{ type: "Write", text }]);
    return { prompt };
  },
});
nodeTools.register({
  name: "generateAudio",
  description: "Start background generation using current prompt, model, language, sample rate, format and optional reference image or audio; image and audio are mutually exclusive with at most one total, text unlimited; returns immediately with started status, use getGenerationStatus to check results, cancelGeneration to stop",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.audioContent {
  position: relative;
  min-height: 144px;
  display: flex;
  align-items: center;

  .audioPreview { display: block; width: 100%; border-radius: var(--el-border-radius-base); }
  .audioEmpty { display: grid; place-items: center; width: 100%; min-height: 144px; color: var(--el-text-color-placeholder); }
  :deep(.el-loading-mask) { pointer-events: none; }
}
.promptCard {
  .promptFooter {
    display: flex;
    align-items: center;
    gap: 12px;

    .modelSelect {
      width: 190px;
      min-width: 0;
      &:deep(.el-select__wrapper) { gap: 6px; padding: 0; box-shadow: none; background: transparent; }
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
