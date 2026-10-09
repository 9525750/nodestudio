<template>
  <el-dialog v-model="visible" title="FFmpeg" width="min(680px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose>
    <el-alert class="installationHint" title="After installation, please retry the previous operation." type="info" :closable="false" showIcon />
    <ffmpeg v-if="visible" :downloadOnOpen="true" />
  </el-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { ElMessageBox } from "element-plus";
import ffmpeg from "./panels/pluginMarket/ffmpeg.vue";

const visible = ref(false);
let pending = false;
const events = new EventSource("/api/ffmpeg/events");
events.onmessage = async event => {
  let data: { type?: string };
  try { data = JSON.parse(event.data); }
  catch { return; }
  if (data?.type !== "required" || pending || visible.value) return;
  pending = true;
  try {
    await ElMessageBox.confirm("This operation requires FFmpeg, but no available version was detected. Download and install?", "FFmpeg Required", {
      confirmButtonText: "Download & Install", cancelButtonText: "Not Now", closeOnClickModal: false,
    });
    if (events.readyState !== EventSource.CLOSED) visible.value = true;
  } catch {
    // Keep the current operation's failure result after user cancellation; do not auto-retry media generation.
  } finally {
    pending = false;
  }
};
onBeforeUnmount(() => events.close());
</script>

<style scoped>
.installationHint { margin-bottom: 12px; }
</style>
