<template>
  <nodeSkeleton
    v-bind="nodeProps"
    :topVisible="node.selected"
    :bottomVisible="node.selected && actions?.mode === 'speed'"
    :bottomWidth="440"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    :fullscreenVisible="false"
    style="width: 360px">
    <template #topActions>
      <el-button :icon="IconScissors" :disabled="!previewUrl || uploading || actions?.processing" text title="Clip audio" aria-label="Clip audio" @click.stop="actions?.open('clip')">Clip</el-button>
      <el-button :icon="IconGauge" :disabled="!previewUrl || uploading || actions?.processing" text title="Speed change" aria-label="Speed change" @click.stop="actions?.open('speed')">Speed</el-button>
      <el-button
        :icon="IconTransfer"
        :loading="uploading"
        :disabled="actions?.processing"
        text
        title="Replace audio"
        aria-label="Replace audio"
        @click.stop="fileInput?.click()">Replace audio</el-button>
    </template>
    <div class="audioContent nopan">
      <audioPlayer
        v-if="previewUrl"
        ref="player"
        class="audioPreview"
        :src="previewUrl"
        @loadedmetadata="updateNodeInternals" />
      <input ref="fileInput" class="fileInput" type="file" accept="audio/*" aria-label="Select audio" :disabled="uploading || actions?.processing" @change="uploadAudio" />
      <el-button
        v-if="!outputs.audio"
        class="uploadButton"
        text
        :loading="uploading"
        title="Upload audio"
        aria-label="Upload audio"
        @dblclick.stop
        @click="fileInput?.click()">
        <icon-upload v-if="!uploading" :size="48" stroke="1.5" />
      </el-button>
    </div>
    <template v-if="actions?.mode === 'speed'" #bottom><div ref="speedTarget" /></template>
  </nodeSkeleton>
  <audioActions ref="actions" :file="outputFile" :src="previewUrl" :target="speedTarget" :disabled="uploading" @pause="player?.pause()" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IconMusic, IconUpload, IconTransfer, IconScissors, IconGauge } from "@tabler/icons-vue";
import { ElButton, ElMessage } from "element-plus";
import { nodeSkeleton, nodeTools, useNode, z, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import audioPlayer from "./components/audioPlayer.vue";
import audioActions from "./components/audioActions.vue";

defineOptions({
  inheritAttrs: false,
  icon: IconMusic,
  handles: [{ id: "audio", type: "source", dataType: "AUDIO", label: "Audio output" }] satisfies NodeHandle[],
});
const { node, nodeProps, outputs, nodeEvent, files, updateNodeInternals } = useNode({
  label: "Audio",
});
const fileInput = ref<HTMLInputElement>();
const uploading = ref(false);
const player = ref<InstanceType<typeof audioPlayer>>();
const actions = ref<InstanceType<typeof audioActions>>();
const speedTarget = ref<HTMLElement>();

const outputFile = computed(() => outputs.value.audio?.dataType === "AUDIO" ? outputs.value.audio.value : undefined);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showError(error, "Failed to read audio")
);

nodeEvent.on("save", reason => {
  if (uploading.value) throw new Error("Audio is processing, please finish before switching or refreshing the node");
  if (reason === "reload" && actions.value?.processing) throw new Error("Audio is processing, please finish or cancel before refreshing the node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Audio is uploading, please try deleting the node later");
  uploading.value = true;
  try {
    await actions.value?.cancelAndWait();
    await files.removeNodeFiles();
  } finally {
    uploading.value = false;
  }
});

nodeTools.register({
  name: "setAudio",
  description: "Select an existing audio file in the workspace as this node's output; path uses workspace-relative path",
  parameters: z.strictObject({
    path: z.string().min(1).max(4096),
    mimeType: z.string().regex(/^audio\/[a-zA-Z0-9.+-]+$/),
  }),
  async execute({ path, mimeType }, { signal }) {
    signal?.throwIfAborted();
    if (uploading.value || actions.value?.processing) throw new Error("Audio is processing, please try again later");
    uploading.value = true;
    try {
      const content = await files.getWorkspaceFiles().read(path);
      signal?.throwIfAborted();
      if (!content.byteLength || content.byteLength > 100 * 1024 * 1024) throw new Error("Audio cannot be empty and cannot exceed 100 MB");
      outputs.value.audio = { dataType: "AUDIO", value: { url: path, mimeType } };
      return outputs.value.audio;
    } finally {
      uploading.value = false;
    }
  },
});

async function uploadAudio(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || uploading.value || actions.value?.processing) return;
  if (!file.type.startsWith("audio/")) return void ElMessage.error("Please select an audio file");
  if (!file.size || file.size > 100 * 1024 * 1024) return void ElMessage.error("Audio cannot be empty and cannot exceed 100 MB");
  uploading.value = true;
  try {
    const url = await files.uploadFile(file);
    // ACT: Copied nodes may still reference old audio; replacing output does not delete shared files.
    outputs.value.audio = { dataType: "AUDIO", value: { url, mimeType: file.type } };
  } catch (error) {
    showError(error, "Failed to replace audio");
  } finally {
    uploading.value = false;
  }
}

function showError(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  ElMessage.error(message || (error instanceof Error ? error.message : fallback));
}
</script>

<style scoped lang="scss">
.audioContent {
  position: relative;
  min-height: 144px;
  display: flex;
  align-items: center;

  .audioPreview {
    display: block;
    width: 100%;
    border-radius: var(--el-border-radius-base);
  }

  .fileInput {
    display: none;
  }

  .uploadButton {
    width: 100%;
    height: 144px;
    padding: 0;
    color: var(--el-text-color-placeholder);

    &:hover {
      color: var(--el-color-primary);
    }
  }
}
</style>
