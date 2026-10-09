<template>
  <mini-map
    v-if="showMap"
    position="bottom-left"
    :style="{ bottom: '64px' }"
    :pannable="true"
    :zoomable="true"
    node-color="var(--el-fill-color-dark)"
    mask-color="var(--el-mask-color-extra-light)" />
  <panel position="bottom-left">
    <elCard shadow="never" :body-style="{ padding: '4px' }">
      <div class="canvasControls">
        <el-tooltip :showArrow="false" :content="assetsVisible ? 'Close asset library' : 'Open asset library'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="assetsVisible ? 'primary' : 'default'"
            :aria-pressed="assetsVisible"
            aria-label="Asset library"
            @click="assetsVisible = !assetsVisible">
            <icon-folders :size="17" />
          </el-button>
        </el-tooltip>
        <!-- trigger uses contextmenu so arrange button is only shown/hidden by arrangeNodes, while still auto-closing on outside click -->
        <el-tooltip :showArrow="false" content="Arrange canvas" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]" :disabled="undoPopoverVisible">
          <span class="toolTrigger">
            <el-popover trigger="contextmenu" placement="top-start" :width="180" v-model:visible="undoPopoverVisible">
              <template #reference>
                <el-button class="toolButton" text :disabled="!canArrange" aria-label="Arrange canvas" @click="arrangeNodes">
                  <icon-sitemap :size="17" />
                </el-button>
              </template>
              <div class="zoomMenu">
                <el-button class="zoomAction" style="width: 100%" text @click="undoArrange">Undo arrangement</el-button>
              </div>
            </el-popover>
          </span>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="showMap ? 'Hide map' : 'Show map'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="showMap ? 'primary' : 'default'"
            :aria-pressed="showMap"
            aria-label="Toggle map"
            @click="showMap = !showMap">
            <icon-map :size="17" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="snapEnabled ? 'Disable grid snap' : 'Enable grid snap'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="snapEnabled ? 'primary' : 'default'"
            :aria-pressed="snapEnabled"
            aria-label="Grid snap"
            @click="snapEnabled = !snapEnabled">
            <icon-magnet :size="17" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="showEdges ? 'Hide connections' : 'Show connections'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="showEdges ? 'primary' : 'default'"
            :aria-pressed="showEdges"
            aria-label="Toggle connections"
            @click="showEdges = !showEdges">
            <icon-arrow-guide :size="17" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" content="Fit view" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button class="toolButton" text aria-label="Fit view" @click="fitView()">
            <icon-focus-centered :size="17" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false"
          content="Zoom menu (scroll to zoom)"
          placement="top"
          :hideAfter="0"
          :enterable="false"
          :triggerKeys="[]"
          :disabled="zoomMenuVisible">
          <span class="toolTrigger">
            <el-popover v-model:visible="zoomMenuVisible" trigger="click" placement="top-start" :width="216">
              <template #reference>
                <el-button
                  class="toolButton"
                  text
                  aria-label="Zoom menu"
                  @wheel.stop.prevent="$event.deltaY && applyZoom(Math.min(800, Math.max(20, zoomPercent - Math.sign($event.deltaY))))">
                  {{ zoomPercent }}%
                </el-button>
              </template>
              <div class="zoomMenu">
                <el-input-number
                  class="zoomInput"
                  :model-value="zoomPercent"
                  :min="20"
                  :max="800"
                  :controls="false"
                  aria-label="Zoom percentage"
                  @change="applyZoom">
                  <template #suffix>%</template>
                </el-input-number>
                <el-button class="zoomAction" text @click="zoomIn()">Zoom in</el-button>
                <el-button class="zoomAction" text @click="zoomOut()">Zoom out</el-button>
                <el-button class="zoomAction" text @click="fitView()">Fit to screen</el-button>
              </div>
            </el-popover>
          </span>
        </el-tooltip>
        <el-tooltip :showArrow="false" content="Help" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]" :disabled="helpVisible">
          <span class="toolTrigger">
            <el-popover v-model:visible="helpVisible" trigger="click" placement="top-end" :width="196">
              <template #reference>
                <el-button class="toolButton" text aria-label="Help">
                  <icon-help :size="17" />
                </el-button>
              </template>
              <div class="helpMenu">
                <el-button
                  class="helpAction"
                  tag="a"
                  text
                  :icon="IconBook"
                  href="https://qcn7xdsqgc4z.feishu.cn/docx/RXFqdgR2Xo0dXZxGfd0cZCGgnwf"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="helpVisible = false">
                  Tutorial
                </el-button>
                <el-button
                  class="helpAction"
                  tag="a"
                  text
                  :icon="IconBug"
                  href="https://docs.qq.com/smartsheet/form/EmvmQBrmlPmr%2Fss_vsqk2v%2FvhiGzE?tab=ss_vsqk2v"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Toonflow Feedback form"
                  @click="helpVisible = false">
                  Report bug
                </el-button>
                <el-button class="helpAction" text :icon="IconBrandWechat" @click="showContact('community')">Join community</el-button>
                <el-button class="helpAction" text :icon="IconBriefcase" @click="showContact('business')">Business inquiries</el-button>
              </div>
            </el-popover>
          </span>
        </el-tooltip>
      </div>
    </elCard>
  </panel>
  <el-dialog v-model="contactVisible" :title="contactInfo.title" width="min(360px, calc(100vw - 32px))" alignCenter appendToBody>
    <div class="contactContent">
      <q-r-code
        :value="contactInfo.url"
        :size="192"
        type="svg"
        color="#000000"
        bgColor="#ffffff"
        borderless
        role="img"
        :aria-label="`${contactInfo.title}QR code`" />
      <p class="contactTip">{{ contactInfo.tip }}</p>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Panel, useVueFlow, type XYPosition } from "@vue-flow/core";
import { MiniMap } from "@vue-flow/minimap";
import { IconMap, IconMagnet, IconFocusCentered, IconHelp, IconBook, IconBug, IconBrandWechat, IconBriefcase } from "@tabler/icons-vue";
import { ElMessage } from "element-plus";
import { QRCode } from "tdesign-vue-next";
import { arrangeCanvas } from "../arrangeCanvas";

const props = defineProps<{
  canvasId: string;
  directory: string | undefined;
  batchHistory: (action: () => Promise<void>) => Promise<void>;
}>();
const snapEnabled = defineModel<boolean>("snapEnabled", { required: true });
const showEdges = defineModel<boolean>("showEdges", { required: true });
const assetsVisible = defineModel<boolean>("assetsVisible", { default: false });
const showMap = ref(false);
const zoomMenuVisible = ref(false);
const helpVisible = ref(false);
const contactVisible = ref(false);
const contactType = ref<"community" | "business">("community");
const contacts = {
  community: {
    title: "Join community",
    url: "https://work.weixin.qq.com/u/vc36adcc89845edcbe?v=5.0.3.63936&bb=85b8d228e8",
    tip: "Toonflow is a community-driven open source project. Replies may take some time.",
  },
  business: {
    title: "Business inquiries",
    url: "https://work.weixin.qq.com/u/vc0f54596c5837d05a?v=5.0.8.70675",
    tip: "This contact is for business inquiries only. For questions, please use the community group or feedback form.",
  },
};
const contactInfo = computed(() => contacts[contactType.value]);
const flow = useVueFlow();
const { viewport, zoomTo, zoomIn, zoomOut, fitView, getNodes, updateNode } = flow;
const zoomPercent = computed(() => Math.round(viewport.value.zoom * 100));
const layoutSnapshot = ref<{ id: string; position: XYPosition }[]>();
const undoPopoverVisible = ref(false);
const arranging = ref(false);
let arrangeController: AbortController | undefined;
const canArrange = computed(() => {
  const nodes = getNodes.value.filter((node) => !node.parentNode);
  return (
    !!props.canvasId &&
    !!props.directory &&
    !arranging.value &&
    nodes.length > 0 &&
    nodes.every((node) => node.dimensions.width > 0 && node.dimensions.height > 0)
  );
});
defineExpose({ arrangeNodes });

watch(
  () => [props.canvasId, props.directory],
  () => {
    arrangeController?.abort();
    layoutSnapshot.value = undefined;
    undoPopoverVisible.value = false;
  },
  { flush: "sync" }
);
onBeforeUnmount(() => arrangeController?.abort());

function showContact(type: "community" | "business") {
  contactType.value = type;
  helpVisible.value = false;
  contactVisible.value = true;
}

function applyZoom(value: number | undefined) {
  if (value !== undefined && Number.isFinite(value)) void zoomTo(value / 100);
}

async function arrangeNodes() {
  if (!canArrange.value) return;
  const controller = new AbortController();
  arrangeController = controller;
  arranging.value = true;
  try {
    await props.batchHistory(async () => {
      const { snapshot, arrangedNodeIds } = await arrangeCanvas(flow, controller.signal);
      controller.signal.throwIfAborted();
      if (!arrangedNodeIds.length) return;
      layoutSnapshot.value = snapshot;
      undoPopoverVisible.value = true;
    });
  } catch (error) {
    if (!controller.signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Failed to arrange canvas");
  } finally {
    arrangeController = undefined;
    arranging.value = false;
  }
}

async function undoArrange() {
  const snapshot = layoutSnapshot.value;
  if (!snapshot) return;
  try {
    await props.batchHistory(async () => {
      const nodeIds = new Set(getNodes.value.map((node) => node.id));
      snapshot.forEach(({ id, position }) => {
        if (nodeIds.has(id)) updateNode(id, { position });
      });
      layoutSnapshot.value = undefined;
      undoPopoverVisible.value = false;
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Failed to undo arrangement");
  }
}
</script>

<style lang="scss" scoped>
.canvasControls {
  display: flex;
  align-items: center;
  gap: 6px;

  .toolTrigger {
    display: inline-flex;
  }

  .toolButton {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    margin-left: 0;
    padding: 0;
  }
}

.zoomMenu {
  display: flex;
  flex-direction: column;

  .zoomInput {
    width: 100%;
  }

  .zoomAction {
    justify-content: flex-start;
    margin-left: 0;
  }
}

.helpMenu {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .helpAction {
    justify-content: flex-start;
    margin-left: 0;
  }
}

.contactContent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .contactTip {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.7;
  }
}
</style>
