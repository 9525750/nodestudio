<template>
  <el-tour v-model="open" :targetAreaClickable="false" :contentStyle="{ maxWidth: 'calc(100vw - 32px)' }" @close="complete">
    <el-tour-step
      v-for="(step, index) in steps"
      :key="step.target"
      :target="() => root?.querySelector<HTMLElement>(step.target) ?? null"
      :title="step.title"
      :description="step.description"
      :prevButtonProps="{ children: 'Previous' }"
      :nextButtonProps="{ children: index === steps.length - 1 ? 'Get started' : 'Next' }" />
    <template #indicators="{ current, total }">{{ current + 1 }} / {{ total }}</template>
  </el-tour>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElTour, ElTourStep } from "element-plus";

defineProps<{ root?: HTMLElement }>();
const storageKey = "toonflow.director3dTour";
const open = ref(localStorage.getItem(storageKey) !== "true");
const steps = [
  {
    target: ".chatFooter",
    title: "Generate scene and plan",
    description: "Describe scene models, character actions and camera requirements, then click \"Generate plan\". If there are linked text, images and videos on the canvas, you can reference them via @.",
  },
  {
    target: ".planContent",
    title: "View and switch plans",
    description: "Generated plans will appear here. Click a plan to preview its animation from the beginning and view the input prompt used for generation; you can also continue entering requirements to generate new plans. Multiple plans share the same base scene and models.",
  },
  {
    target: ".viewport",
    title: "First-person framing",
    description: "Click the 3D viewport, then use the mouse to adjust the direction. WASD to move, Space to go up, Shift to go down, scroll to zoom; left-click or Esc to exit framing.",
  },
  {
    target: ".stagePanel .referenceList",
    title: "Record keyframes",
    description: "Right-click while framing, or click \"Add keyframe\" to record the current camera. Keyframes here can be dragged to reorder, clicked to review or deleted. When generating a plan again, the AI will reference these framings and their order to design camera movement. Click the export button to export keyframe images.",
  },
  {
    target: ".playbackBar",
    title: "Playback and display settings",
    description: "Use the play button and progress bar to check animations; adjust aspect ratio, grid, sky and lighting here to make the preview match your vision.",
  },
  {
    target: '[aria-label="Export video node"]',
    title: "Export to canvas",
    description: "After selecting a plan, click here to export a video node. The export button on keyframe thumbnails can generate image nodes. Please keep the window visible during video export; return to the canvas to view results when done.",
  },
];

function complete() {
  localStorage.setItem(storageKey, "true");
}
</script>
