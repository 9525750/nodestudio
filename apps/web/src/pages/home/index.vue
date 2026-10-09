<template>
  <el-container class="home">
    <bg class="pageBackground" />
    <el-header class="pageHeader">
      <el-badge isDot :hidden="!hasDesktopUpdate">
        <el-button round size="large" :icon="IconSettings" :aria-label="hasDesktopUpdate ? 'Settings, new version available' : 'Settings'" @click="settingsVisible = true">Settings</el-button>
      </el-badge>
      <div class="githubAction">
        <span class="arrowHint starHint">
          Give us a Star to show your support
          <svg viewBox="0 0 84 44" fill="none" aria-hidden="true">
            <path d="M4 29C18 40 44 38 44 18C44 1 21 3 24 19C27 37 57 32 77 16M65 17L77 16L73 28" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <el-button round size="large" :icon="IconBrandGithub" tag="a" href="https://github.com/HBAI-Ltd/Toonflow-app" target="_blank" rel="noopener noreferrer">GitHub</el-button>
      </div>
    </el-header>
    <el-main class="pageContent">
      <section class="creationPanel" aria-label="Create project">
        <div class="brand">
          <el-image class="brandLogo" :src="logoUrl" fit="contain" alt="Toonflow" />
          <h1>Toonflow</h1>
        </div>
        <div class="promptArea">
          <span class="arrowHint inspirationHint">
            Inspiration mode
            <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
              <path d="M4 9C21 0 44 5 40 23C36 39 14 34 22 20C30 7 49 21 47 52M38 43L47 52L54 42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <el-card class="promptCard" shadow="never" :bodyStyle="{ padding: '20px' }" :footerStyle="{ padding: '12px 16px' }">
            <attachmentList v-if="promptAttachments.length" class="promptAttachments" :attachments="promptAttachments" removable restorable :disabled="creating || opening" @remove="promptAttachments.splice($event, 1)" @restore="restoreAttachment" />
            <el-input ref="promptInput" v-model="prompt" type="textarea" :rows="4" resize="none" :disabled="creating || opening" :placeholder="promptPlaceholder" aria-label="Creation description" @paste.capture="pasteText" />
            <template #footer>
              <div class="composerFooter">
                <workspacePicker ref="promptWorkspacePicker" v-model="workspaceDirectory" :disabled="creating || opening" />
                <el-space class="sendActions" wrap :size="12">
                  <modelPopover v-model="selectedModel" v-model:reasoningEffort="reasoningEffort" class="modelSelect" :disabled="creating || opening" />
                  <el-button class="sendButton" type="primary" :circle="!!workspaceDirectory" :icon="workspaceDirectory ? IconArrowUp : IconFolder" :loading="creating" :disabled="creating || opening" :aria-label="workspaceDirectory ? 'Send' : 'Select working directory'" @click="workspaceDirectory ? createProject() : promptWorkspacePicker?.chooseDirectory()">
                    <template v-if="!workspaceDirectory" #default>Select working directory</template>
                  </el-button>
                </el-space>
              </div>
              <p v-if="!workspaceDirectory" class="workspaceHint" role="status">Select an empty folder as the working directory first; canvases and assets will be saved there.</p>
            </template>
          </el-card>
        </div>
      </section>
      <section class="projectList" aria-labelledby="projectListTitle">
        <div class="sectionHeader">
          <h2 id="projectListTitle">Projects</h2>
          <el-space wrap>
            <el-button :icon="iconFolderOpen" :disabled="creating || opening" @click="openProject()">Import project</el-button>
            <el-button :icon="IconFolderPlus" :disabled="creating || opening" @click="createProject(false)">Add project</el-button>
            <el-button circle :icon="sortDescending ? IconSortDescending : IconSortAscending" :aria-label="sortDescending ? 'Sort by time descending' : 'Sort by time ascending'" @click="sortDescending = !sortDescending" />
            <el-radio-group v-model="viewMode" aria-label="Project view">
              <el-radio-button value="grid" aria-label="Grid view"><icon-layout-grid :size="16" /></el-radio-button>
              <el-radio-button value="list" aria-label="List view"><icon-list :size="16" /></el-radio-button>
            </el-radio-group>
          </el-space>
        </div>
        <div class="projectItems" :class="{ listView: viewMode === 'list' }">
          <el-card v-for="project in sortedProjects" :key="project.directory" class="projectCard" shadow="hover" :bodyStyle="{ padding: '0' }">
            <button class="projectEntry" type="button" :disabled="creating || opening" :aria-label="`Open project ${project.name}`" @click="openProject(project)">
              <icon-folder class="projectIcon" :size="28" aria-hidden="true" />
              <span class="projectInfo">
                <span class="projectName" :title="project.name">{{ project.name }}</span>
                <span class="projectPath" :title="project.directory">{{ project.directory }}</span>
                <span class="projectTime">Last opened {{ new Date(project.lastOpenedAt).toLocaleString(locale, { hour12: false }) }}</span>
              </span>
            </button>
            <div class="projectActions">
              <el-button text :icon="IconEdit" :disabled="creating || opening" :aria-label="`Rename project ${project.name}`" title="Rename" @click="renameProject(project)" />
              <el-button text type="danger" :icon="IconTrash" :disabled="creating || opening" :aria-label="`Remove project ${project.name}`" title="Remove from list without deleting files" @click="workspaceStore.removeProject(project.directory)" />
            </div>
          </el-card>
        </div>
      </section>
    </el-main>
    <settings v-model="settingsVisible" />
    <workspacePicker ref="relocationPicker" hideTrigger />
  </el-container>
</template>

<script setup lang="ts">
import { locale, translate } from "@toonflow/i18n/vue";
import axios from "axios";
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type InputInstance } from "element-plus";
import {
  IconSettings, IconBrandGithub,
  IconArrowUp, IconLayoutGrid,
  IconList, IconSortDescending,
  IconSortAscending, IconFolder, IconEdit,
  IconTrash, IconFolderPlus, IconFolderOpen as iconFolderOpen,
} from "@tabler/icons-vue";
import modelPopover from "@/components/modelPopover.vue";
import attachmentList from "@/components/agent/attachmentList.vue";
import { createPastedTextFile, readTextAttachment } from "@/components/agent/textAttachments";
import type { AgentAttachment } from "@/components/agent/types";
import logoUrl from "@toonflow/assets/logo.svg";
import { useWorkspaceStore, type Project } from "@/stores/workspace";
import { hasDesktopUpdate } from "@/stores/desktopUpdate";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import settings from "@/components/settings/index.vue";
import bg from "./bg.vue";
import workspacePicker from "./workspacePicker.vue";

const settingsVisible = ref(false);
const router = useRouter();
const creating = ref(false);
const opening = ref(false);
const promptWorkspacePicker = ref<InstanceType<typeof workspacePicker>>();
const relocationPicker = ref<InstanceType<typeof workspacePicker>>();
const prompt = ref("");
const promptInput = ref<InputInstance>();
const promptAttachments = ref<AgentAttachment[]>([]);
const workspaceStore = useWorkspaceStore();
const { project, projectList } = storeToRefs(workspaceStore);
const workspaceDirectory = ref(project.value?.directory ?? "");
const placeholderPhrases = [
  "Describe what you want to create and let the inspiration start here…",
  "Turn a story idea into a great short film…",
  "Design a unique look and personality for your protagonist…",
  "Create a cinematic shot of a rainy night street…",
  "Break this text down into a coherent storyboard…",
  "Generate scenes and characters for a fantasy adventure…",
  "Add fitting music to your visuals…",
  "Write a warm narration that tells this story…",
  "Design an imaginative product promo video…",
  "Start from a single sentence and build your creative workflow…",
];
const promptPlaceholder = ref(translate(placeholderPhrases[0]!));

onMounted(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let phraseIndex = 0;
  watch([() => !!prompt.value, locale], ([hasInput], _previous, onCleanup) => {
    if (reduceMotion) {
      promptPlaceholder.value = translate(placeholderPhrases[0]!);
      return;
    }
    if (hasInput) return;
    const segmenter = new Intl.Segmenter(locale.value, { granularity: "grapheme" });
    const phrases = placeholderPhrases.map(phrase => [...segmenter.segment(translate(phrase))].map(part => part.segment));
    let characterCount = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    promptPlaceholder.value = "";

    function typePlaceholder() {
      const phrase = phrases[phraseIndex]!;
      characterCount += deleting ? -1 : 1;
      promptPlaceholder.value = phrase.slice(0, characterCount).join("");
      let delay = deleting ? 35 : 85;
      if (characterCount === phrase.length) {
        deleting = true;
        delay = 1800;
      } else if (characterCount === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % placeholderPhrases.length;
        delay = 300;
      }
      timer = setTimeout(typePlaceholder, delay);
    }

    timer = setTimeout(typePlaceholder, 300);
    onCleanup(() => clearTimeout(timer));
  }, { immediate: true });
});

const selectedModel = ref("");
const reasoningEffort = ref("");
const sortDescending = ref(true);
const viewMode = ref("grid");
const sortedProjects = computed(() => [...projectList.value].sort((left, right) =>
  sortDescending.value ? right.lastOpenedAt - left.lastOpenedAt : left.lastOpenedAt - right.lastOpenedAt
));

function pasteText(event: ClipboardEvent) {
  if (creating.value || opening.value) return;
  try {
    const file = createPastedTextFile(event.clipboardData?.getData("text/plain") ?? "");
    if (!file) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (promptAttachments.value.length >= 20) return ElMessage.warning("You can add up to 20 attachments per message");
    promptAttachments.value.push({ name: file.name, path: "", mimeType: file.type, file });
  } catch (error) {
    event.preventDefault();
    event.stopImmediatePropagation();
    ElMessage.error(error instanceof Error ? error.message : "Failed to add text attachment, please try again");
  }
}

async function restoreAttachment(index: number) {
  const attachment = promptAttachments.value[index];
  if (!attachment || creating.value || opening.value) return;
  try {
    const text = await readTextAttachment(attachment);
    const currentIndex = promptAttachments.value.indexOf(attachment);
    if (currentIndex < 0 || creating.value || opening.value) return;
    prompt.value += `${prompt.value ? "\n" : ""}${text}`;
    promptAttachments.value.splice(currentIndex, 1);
    await nextTick();
    promptInput.value?.focus();
    promptInput.value?.textarea?.setSelectionRange(prompt.value.length, prompt.value.length);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Failed to restore text, please try again");
  }
}

async function openProject(project?: Project) {
  if (creating.value || opening.value) return;
  opening.value = true;
  try {
    const directory = project?.directory ?? await relocationPicker.value?.chooseDirectory();
    if (!directory) return;
    try { await workspaceStore.openProject(directory); }
    catch (err) {
      if (!project || !axios.isAxiosError(err) || err.response?.status !== 404) throw err;
      const reselect = await ElMessageBox.confirm(`The folder for project "${project.name}" does not exist. Select a folder again?`, "Working directory does not exist", {
        confirmButtonText: "Select again", cancelButtonText: "Cancel", type: "warning",
      }).then(() => true, () => false);
      if (!reselect) return;
      const directory = await relocationPicker.value?.chooseDirectory();
      if (!directory) return;
      await workspaceStore.openProject(directory, project.directory);
    }
    await router.push("/workspace");
  } catch (err) {
    ElMessage.error(axios.isAxiosError<{ message?: string }>(err)
      ? err.response?.data.message || "Unable to open the project, please try again"
      : err instanceof Error ? err.message : "Unable to open the project, please try again");
  } finally { opening.value = false; }
}

async function renameProject(project: Project) {
  const result = await ElMessageBox.prompt("Enter a project name", "Rename project", {
    inputValue: project.name, confirmButtonText: "Save", cancelButtonText: "Cancel",
    inputValidator: value => !!value?.trim() || "Project name cannot be empty",
  }).catch(() => null);
  if (result) workspaceStore.renameProject(project.directory, result.value);
}

async function createProject(fromPrompt = true) {
  if (creating.value || opening.value || (fromPrompt && !workspaceDirectory.value)) return;
  creating.value = true;
  try {
    let path = workspaceDirectory.value;
    if (!fromPrompt) {
      const confirmed = await ElMessageBox.confirm("Select an empty folder as the project directory; canvases and assets will be saved in it.", "Add project", {
        confirmButtonText: "Select empty folder", cancelButtonText: "Cancel", type: "info",
      }).then(() => true, () => false);
      if (!confirmed) return;
      path = await relocationPicker.value?.chooseDirectory() ?? "";
      if (!path) return;
    }
    const { directory, empty } = await useWorkspaceFiles(path).list();
    if (!empty) return ElMessage.warning("This folder is not empty. Select an empty folder again; for existing projects, use \"Import project\" or click one in the project list to open it.");
    await useWorkspaceFiles(directory).writeJson("画布1.json", { toonflowCanvas: true, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }, true);
    await workspaceStore.openProject(directory);
    if (fromPrompt && (prompt.value.trim() || promptAttachments.value.length)) {
      workspaceStore.pendingAgentMessage = { directory: workspaceStore.project!.directory, prompt: prompt.value, attachments: [...promptAttachments.value], model: selectedModel.value, reasoningEffort: reasoningEffort.value };
    }
    await router.push("/workspace");
  } catch (err) {
    ElMessage.error(axios.isAxiosError<{ message?: string }>(err)
      ? err.response?.data.message || "Failed to create the project, please try again"
      : err instanceof Error ? err.message : "Failed to create the project, please try again");
  } finally {
    creating.value = false;
  }
}
</script>

<style lang="scss" scoped>
.home {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  color: var(--el-text-color-primary);

  .pageBackground {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  .arrowHint {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--el-color-primary);
    font-size: 13px;
    white-space: nowrap;
    pointer-events: none;
    animation: hintNudge 2.4s ease-in-out infinite;

    svg {
      width: 56px;
      height: 30px;
      flex-shrink: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  .pageHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 clamp(20px, 4vw, 56px);

    a {
      text-decoration: none;
    }

    .githubAction {
      position: relative;

      .starHint {
        top: 0;
        inset-inline-end: calc(100% + 12px);
        height: 100%;

        &:dir(rtl) svg { transform: scaleX(-1); }

        @media (max-width: 560px) {
          top: calc(100% + 6px);
          inset-inline-end: 0;
          height: auto;

          svg { transform: rotate(-45deg); }
          &:dir(rtl) svg { transform: scaleX(-1) rotate(-45deg); }
        }
      }
    }
  }

  .pageContent {
    padding: 24px clamp(20px, 4vw, 56px) 56px;

    .creationPanel {
      max-width: 800px;
      margin: clamp(32px, 6vh, 64px) auto 56px;

      .brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-bottom: 36px;

        .brandLogo {
          width: 48px;
          height: 48px;

          .dark & {
            filter: invert(1);
          }
        }

        h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 38px);
          font-weight: 600;
          letter-spacing: -1px;
        }
      }

      .promptArea {
        position: relative;

        .inspirationHint {
          bottom: calc(100% + 4px);
          left: 16px;
          height: 30px;
          padding-right: 44px;

          svg {
            position: absolute;
            top: -2px;
            right: 0;
            width: 36px;
            height: 36px;
          }
        }

        .promptCard {
          border-radius: calc(var(--ui-radius) * 2.5);
          border-color: var(--el-border-color-lighter);
          box-shadow: var(--el-box-shadow-lighter);

          &:focus-within {
            border-color: var(--el-color-primary-light-5);
          }

          .promptAttachments {
            margin-bottom: 12px;
          }

          :deep(.el-textarea__inner) {
            padding: 4px 0;
            box-shadow: none;
            background: transparent;
            font-size: 15px;
            line-height: 1.8;
          }

          :deep(.el-card__footer) {
            background: var(--el-fill-color-extra-light);
          }

          .composerFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;

            .sendActions {
              margin-left: auto;
              justify-content: flex-end;

              .modelSelect {
                width: 190px;
              }

              .sendButton {
                height: 36px;

                &.is-circle { width: 36px; }
              }
            }
          }

          .workspaceHint {
            margin: 12px 0 0;
            color: var(--el-text-color-regular);
            font-size: 13px;
            line-height: 1.6;
          }
        }
      }
    }

    .projectList {
      max-width: 1040px;
      margin: 0 auto;

      .projectItems {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
        gap: 16px;
        margin-top: 16px;

        &.listView { grid-template-columns: 1fr; }

        .projectCard {
          position: relative;

          .projectActions {
            position: absolute;
            top: 12px;
            right: 8px;
            display: flex;
            gap: 4px;

            .el-button { width: 32px; height: 32px; margin: 0; padding: 0; }
          }
        }

        .projectEntry {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          padding: 20px 84px 20px 20px;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;

          &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
          &:disabled { cursor: wait; opacity: 0.6; }

          .projectIcon { flex-shrink: 0; color: var(--el-color-primary); }

          .projectInfo {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;

            .projectName, .projectPath {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .projectName { font-weight: 600; }
            .projectPath { font-size: 13px; color: var(--el-text-color-regular); }
            .projectTime { font-size: 12px; color: var(--el-text-color-secondary); }
          }
        }
      }

      .sectionHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--el-border-color-lighter);

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
      }
    }
  }
}

@keyframes hintNudge {
  0%, 100% { transform: translateX(0) rotate(-3deg); }
  50% { transform: translateX(-6px) rotate(-5deg); }
}
</style>
