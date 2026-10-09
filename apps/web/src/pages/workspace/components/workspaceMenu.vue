<template>
  <div class="workspaceMenu">
    <el-card shadow="never" :bodyStyle="{ padding: '5px 10px' }">
      <div class="menuContent">
        <el-button class="toolButton" text aria-label="Exit project" title="Exit project" @click="exitVisible = true">
          <icon-x :size="17" aria-hidden="true" />
        </el-button>
        <el-button class="toolButton" text :aria-label="hasDesktopUpdate ? 'Settings, update available' : 'Settings'" title="Settings" @click="emit('openSettings')">
          <el-badge isDot :hidden="!hasDesktopUpdate">
            <icon-settings :size="17" aria-hidden="true" />
          </el-badge>
        </el-button>
      </div>
    </el-card>
    <el-dialog v-model="exitVisible" title="Exit project" width="360px" alignCenter appendToBody>
      <span>Exit the current project and return to the home page?</span>
      <template #footer>
        <el-button @click="exitVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="leaving" @click="exitProject">Exit project</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { IconX, IconSettings } from "@tabler/icons-vue";
import { hasDesktopUpdate } from "@/stores/desktopUpdate";

const emit = defineEmits<{ openSettings: [] }>();
const router = useRouter();
const exitVisible = ref(false);
const leaving = ref(false);

async function exitProject() {
  if (leaving.value) return;
  leaving.value = true;
  try {
    await router.push("/home");
  } finally {
    leaving.value = false;
  }
}
</script>

<style scoped lang="scss">
.workspaceMenu {
  .menuContent {
    display: flex;
    align-items: center;
    gap: 10px;

    .toolButton {
      width: 28px;
      height: 28px;
      margin: 0;
      padding: 0;
    }
  }
}
</style>
