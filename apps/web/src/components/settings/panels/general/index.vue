<template>
  <div class="general">
    <section class="settingSection" aria-labelledby="startupTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="startupTitle">Startup Animation</h3>
          <p class="description">Play an animation at startup. Turning it off speeds up launch but may cause screen flashing; takes effect on the next launch.</p>
        </div>
        <el-switch
          :modelValue="uiSettings.startupAnimation"
          aria-label="Startup animation"
          @change="(value) => updateUiSettings({ startupAnimation: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasCompositingTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasCompositingTitle">Canvas Compositing Optimization</h3>
          <p class="description">Optimizes panning and zooming with many nodes. May increase GPU memory usage and cause blurriness; takes effect immediately.</p>
        </div>
        <el-switch
          :modelValue="generalSettings.canvasCompositingEnabled"
          aria-label="Canvas compositing optimization"
          @change="(value) => updateGeneralSettings({ canvasCompositingEnabled: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasEdgeAnimationTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasEdgeAnimationTitle">Node Edge Animation</h3>
          <p class="description">When a node is selected or dragged, the edges directly connected to it show a flowing animation. Highlighting is kept when turned off; takes effect immediately.</p>
        </div>
        <el-switch
          :modelValue="generalSettings.canvasEdgeAnimationEnabled"
          aria-label="Node edge animation"
          @change="(value) => updateGeneralSettings({ canvasEdgeAnimationEnabled: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasEdgeColorTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasEdgeColorTitle">Node Edge Highlight Color</h3>
          <p class="description">Sets the highlight color of the edges directly connected to a node when it is selected or dragged; takes effect immediately.</p>
        </div>
        <div class="edgeColorControls">
          <el-select
            :modelValue="generalSettings.canvasEdgeColorMode"
            aria-label="Node edge color mode"
            @change="(value) => updateGeneralSettings({ canvasEdgeColorMode: value })">
            <el-option label="No highlight color" value="none" />
            <el-option label="Follow theme color" value="theme" />
            <el-option label="Custom color" value="custom" />
          </el-select>
          <el-color-picker
            v-if="generalSettings.canvasEdgeColorMode === 'custom'"
            :modelValue="generalSettings.canvasEdgeColor"
            colorFormat="hex"
            aria-label="Node edge custom color"
            @change="(value) => updateGeneralSettings({ canvasEdgeColor: value || defaultUiSettings.primaryColor })" />
        </div>
      </div>
    </section>
    <canvasShortcuts />
  </div>
</template>

<script setup lang="ts">
import { defaultUiSettings, generalSettings, uiSettings, updateGeneralSettings, updateUiSettings } from "@/stores/settings";
import canvasShortcuts from "./canvasShortcuts.vue";
</script>

<style lang="scss" scoped>
.general {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 4px 8px;

  .settingSection {
    .settingHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;

      > .el-switch { flex-shrink: 0; }

      .edgeColorControls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;

        .el-select { width: 140px; }
      }

      .settingInfo {
        min-width: 0;

        h3 {
          margin: 0;
          color: var(--el-text-color-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .description {
          margin: 6px 0 0;
          color: var(--el-text-color-secondary);
          font-size: 12px;
          line-height: 1.6;
        }
      }
    }
  }
}
</style>
