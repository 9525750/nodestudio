<template>
  <nodeSkeleton
    v-bind="nodeProps"
    :topVisible="node.selected"
    topWidth="max-content"
    :downloadUrl="exporting ? '' : previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    :style="{ width: previewUrl && videoWidth ? `${videoWidth + 18}px` : undefined }"
    @fullscreen="player?.enterFullscreen()">
    <template #topActions>
      <el-button :icon="IconMusic" text :disabled="!outputFile || uploading || exporting || actions?.processing" @click.stop="actions?.open('extractAudio')">Extract audio track</el-button>
      <el-button :icon="IconLayersSubtract" text :disabled="!outputFile || uploading || exporting || actions?.processing" @click.stop="actions?.open('separate')">Separate audio and video</el-button>
      <el-button :icon="IconScissors" text :disabled="!outputFile || uploading || exporting || actions?.processing" @click.stop="actions?.open('trim')">Trim clip</el-button>
      <el-button
        :icon="IconTransfer"
        :loading="uploading"
        :disabled="exporting"
        text
        title="Replace video"
        aria-label="Replace video"
        @click.stop="fileInput?.click()">Replace video</el-button>
    </template>
    <template #topRightActions>
      <el-dropdown trigger="click" placement="bottom-end" :disabled="!player?.ready || player?.capturing || uploading || exporting" @command="player?.captureFrame($event)">
        <el-button :icon="IconPhotoScan" :loading="player?.capturing" :disabled="!player?.ready || player?.capturing || uploading || exporting" text title="Capture video frame" aria-label="Capture video frame" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="current" :icon="IconPhotoScan">Capture current frame</el-dropdown-item>
            <el-dropdown-item command="first" :icon="IconPlayerSkipBack">Capture first frame</el-dropdown-item>
            <el-dropdown-item command="last" :icon="IconPlayerSkipForward">Capture last frame</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <div class="videoContent nopan">
      <div v-if="exporting" class="exportLoading" role="status" aria-label="Exporting video">
        <el-progress type="circle" :percentage="exportProgress" :width="64" :strokeWidth="3" />
        <span>Exporting video...</span>
      </div>
      <videoPlayer
        v-else-if="previewUrl"
        ref="player"
        :src="previewUrl"
        @loadedmetadata="resizeVideo" />
      <input ref="fileInput" class="fileInput" type="file" accept="video/*" aria-label="Select video" :disabled="uploading || exporting" @change="uploadVideo" />
      <el-button
        v-if="!exporting && !outputs.video"
        class="uploadButton"
        text
        :loading="uploading"
        title="Upload video"
        aria-label="Upload video"
        @dblclick.stop
        @click="fileInput?.click()">
        <icon-upload v-if="!uploading" :size="48" stroke="1.5" />
      </el-button>
    </div>
  </nodeSkeleton>
  <videoActions ref="actions" :file="outputFile" :src="previewUrl" :disabled="uploading || exporting" />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { IconVideo, IconUpload, IconTransfer, IconMusic, IconLayersSubtract, IconScissors, IconPhotoScan, IconPlayerSkipBack, IconPlayerSkipForward } from "@tabler/icons-vue";
import { ElButton, ElMessage, ElProgress, ElDropdown, ElDropdownMenu, ElDropdownItem } from "element-plus";
import { nodeSkeleton, nodeTools, useNode, z, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import videoPlayer from "@toonflow/nodes-scaffold/videoPlayer";
import videoActions from "./components/videoActions.vue";

defineOptions({
  inheritAttrs: false,
  icon: IconVideo,
  handles: [{ id: "video", type: "source", dataType: "VIDEO", label: "Video output" }] satisfies NodeHandle[],
});
const { node, nodeProps, outputs, nodeEvent, files, updateNodeInternals } = useNode({
  label: "Video",
});
const fileInput = ref<HTMLInputElement>();
const uploading = ref(false);
const player = ref<InstanceType<typeof videoPlayer>>();
const actions = ref<InstanceType<typeof videoActions>>();
const exportProgress = computed(() => (node.data as typeof node.data & { exportProgress?: number }).exportProgress);
const exporting = computed(() => typeof exportProgress.value === "number");
const videoWidth = ref(0);

const outputFile = computed(() => outputs.value.video?.dataType === "VIDEO" ? outputs.value.video.value : undefined);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showError(error, "Failed to load video")
);

nodeEvent.on("save", (reason) => {
  if (uploading.value) throw new Error("Video is processing, please finish before switching or reloading the node");
  if (reason === "reload" && exporting.value) throw new Error("Video is exporting, please finish before reloading the node");
});
nodeEvent.on("delete", () => {
  if (uploading.value) throw new Error("Video is uploading, please delete the node later");
  uploading.value = true;
  return files.removeNodeFiles().finally(() => {
    uploading.value = false;
  });
});

nodeTools.register({
  name: "setVideo",
  description: "Select an existing video file in the workspace as this node's output; path uses workspace-relative path",
  parameters: z.strictObject({
    path: z.string().min(1).max(4096),
    mimeType: z.string().regex(/^video\/[a-zA-Z0-9.+-]+$/),
  }),
  async execute({ path, mimeType }, { signal }) {
    signal?.throwIfAborted();
    if (uploading.value || exporting.value) throw new Error("Video is processing, please try again later");
    uploading.value = true;
    try {
      const content = await files.getWorkspaceFiles().read(path);
      signal?.throwIfAborted();
      if (!content.byteLength || content.byteLength > 100 * 1024 * 1024) throw new Error("Video cannot be empty and must not exceed 100 MB");
      outputs.value.video = { dataType: "VIDEO", value: { url: path, mimeType } };
      return outputs.value.video;
    } finally {
      uploading.value = false;
    }
  },
});

async function resizeVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (!video.videoWidth || !video.videoHeight) return;
  videoWidth.value = Math.max(180, (240 * video.videoWidth) / video.videoHeight);
  await nextTick();
  updateNodeInternals();
}

async function uploadVideo(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || uploading.value || exporting.value) return;
  if (!file.type.startsWith("video/")) return void ElMessage.error("Please select a video file");
  if (!file.size || file.size > 100 * 1024 * 1024) return void ElMessage.error("Video cannot be empty and must not exceed 100 MB");
  uploading.value = true;
  try {
    const url = await files.uploadFile(file);
    // ACT: 复制节点可能仍引用旧视频，替换输出不删除共享文件。
    outputs.value.video = { dataType: "VIDEO", value: { url, mimeType: file.type } };
  } catch (error) {
    showError(error, "视频替换失败");
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
.videoContent {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 144px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .exportLoading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    color: var(--el-text-color-secondary);
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
