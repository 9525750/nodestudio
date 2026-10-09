<template>
  <section class="nodeMarkdownEditor">
    <div class="editorToolbar" role="toolbar" aria-label="Markdown editing tools">
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('heading')">Heading</button>
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('bold')">Bold</button>
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('italic')">Italic</button>
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('list')">List</button>
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('undo')">Undo</button>
      <button type="button" :disabled="locked || sourceMode || !ready" @mousedown.prevent @click="run('redo')">Redo</button>
      <span class="toolbarSpacer" />
      <button type="button" @click="copyText">Copy text</button>
      <button type="button" :aria-pressed="sourceMode" @click="sourceMode = !sourceMode">{{ sourceMode ? 'Rich text' : 'Source' }}</button>
    </div>
    <p v-if="error" class="editorError" role="alert">{{ error }}</p>
    <textarea v-if="sourceMode" class="sourceEditor" :value="modelValue" :readonly="readonly" :disabled="disabled" :aria-label="ariaLabel || 'Edit Markdown source'" spellcheck="false" @input="updateSource" />
    <editor-content v-if="editor && !sourceMode" :editor="editor" class="richHost" />
    <p class="editorHint">Rich text normalizes Markdown; use Source to preserve raw HTML.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import type { MarkdownProps } from "./markdownContent";
import markdownExtensions, { parseMarkdownContent, serializeMarkdown } from "./markdownExtensions";

const props = withDefaults(defineProps<MarkdownProps>(), { active: true });
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const sourceMode = ref(false);
const editor = shallowRef<Editor>();
const ready = computed(() => !!editor.value);
const error = ref("");
const locked = computed(() => !!(props.disabled || props.readonly));
let lastMarkdown = "";

function destroyEditor() {
  editor.value?.destroy();
  editor.value = undefined;
}
function rebuild() {
  destroyEditor();
  if (!props.active || sourceMode.value) return;
  error.value = "";
  try {
    lastMarkdown = props.modelValue;
    editor.value = new Editor({
      extensions: markdownExtensions({ files: props.files, resource: { path: props.path || "" } }),
      content: parseMarkdownContent(props.modelValue),
      editable: !locked.value,
      editorProps: {
        attributes: { class: "textNodeMarkdown", "aria-label": props.ariaLabel || "Edit text content", role: "textbox", "aria-multiline": "true" },
        transformPastedHTML: parseMarkdownContent,
        handlePaste(_view, event) {
          const current = editor.value;
          const clipboard = event.clipboardData;
          if (!current || locked.value || current.isActive("codeBlock") || clipboard?.getData("text/html")) return false;
          const text = clipboard?.getData("text/markdown") || clipboard?.getData("text/plain");
          return !!text && current.commands.insertContent(parseMarkdownContent(text));
        },
      },
      onUpdate({ editor: current }) {
        if (!props.active || sourceMode.value) return;
        lastMarkdown = serializeMarkdown(current);
        // Synchronously update node output; do not wait for debounce callback when closing dialog or saving canvas.
        emit("update:modelValue", lastMarkdown);
      },
    });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Editor failed to load, switch to Source to continue editing";
  }
}

watch([() => props.active, sourceMode, () => props.files, () => props.path], rebuild, { immediate: true, flush: "post" });
watch(() => props.modelValue, value => {
  if (!editor.value || !props.active || value === lastMarkdown) return;
  try {
    editor.value.commands.setContent(parseMarkdownContent(value), { emitUpdate: false });
    lastMarkdown = value;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Text update failed"; }
});
watch(locked, value => editor.value?.setEditable(!value, false));
onBeforeUnmount(destroyEditor);

function run(action: "heading" | "bold" | "italic" | "list" | "undo" | "redo") {
  if (!editor.value || locked.value || !props.active) return;
  const chain = editor.value.chain().focus();
  if (action === "heading") chain.toggleHeading({ level: 2 }).run();
  else if (action === "bold") chain.toggleBold().run();
  else if (action === "italic") chain.toggleItalic().run();
  else if (action === "list") chain.toggleBulletList().run();
  else if (action === "undo") chain.undo().run();
  else chain.redo().run();
}
function updateSource(event: Event) {
  if (!locked.value && props.active) emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
async function copyText() {
  try {
    if (props.writeClipboardText) await props.writeClipboardText(props.modelValue);
    else await navigator.clipboard.writeText(props.modelValue);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Copy failed, please select and copy from source"; }
}
</script>

<style scoped lang="scss">
.nodeMarkdownEditor {
  display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden;
  .editorToolbar { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 0 8px; flex-shrink: 0;
    button { border: 1px solid var(--el-border-color); border-radius: 4px; padding: 4px 8px; color: var(--el-text-color-primary); background: var(--el-bg-color); cursor: pointer;
      &:hover { border-color: var(--el-color-primary); }
      &:disabled { opacity: 0.45; cursor: default; }
    }
    .toolbarSpacer { flex: 1; }
  }
  .editorError { flex-shrink: 0; margin: 0 0 6px; color: var(--el-color-danger); }
  .sourceEditor { flex: 1; min-height: 0; width: 100%; box-sizing: border-box; resize: none; padding: 12px; border: 1px solid var(--el-border-color); color: var(--el-text-color-primary); background: var(--el-bg-color); font: 14px/1.8 Consolas, monospace; }
  .richHost { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--el-border-color); overscroll-behavior: contain;
    :deep(.ProseMirror) { min-height: 180px; padding: 12px 16px; outline: none; white-space: pre-wrap; word-break: break-word; }
    :deep(.ProseMirror-selectednode) { outline: 2px solid var(--el-color-primary); }
  }
  .editorHint { flex-shrink: 0; margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 11px; }
}
</style>
