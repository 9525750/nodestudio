<template>
  <el-dialog v-model="visible" title="Connect Remote Agent" width="min(520px, calc(100vw - 32px))" alignCenter appendToBody :closeOnClickModal="false" :closeOnPressEscape="!saving" :showClose="!saving" @closed="emit('closed')">
    <el-form labelPosition="top" :disabled="saving" @submit.prevent="connect">
      <el-form-item label="Identifier"><el-input v-model="name" placeholder="e.g. storyAgent" autocomplete="off" :maxlength="96" /></el-form-item>
      <el-form-item label="Agent Card URL"><el-input v-model="cardUrl" placeholder="https://example.com/.well-known/agent-card.json" autocomplete="off" /></el-form-item>
      <el-form-item label="Access token (optional)"><el-input v-model="token" type="password" showPassword autocomplete="off" /></el-form-item>
      <el-alert v-if="error" :title="error" type="error" :closable="false" showIcon />
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Cancel</el-button>
      <el-button type="primary" :loading="saving" :disabled="!name.trim() || !cardUrl.trim()" @click="connect">Connect</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { ref } from "vue";
import { ElMessage } from "element-plus";

const emit = defineEmits<{ saved: []; closed: [] }>();
const visible = ref(true);
const name = ref("");
const cardUrl = ref("");
const token = ref("");
const saving = ref(false);
const error = ref("");

async function connect() {
  if (saving.value) return;
  error.value = "";
  if (!/^[a-z][a-zA-Z0-9]{0,95}$/.test(name.value.trim())) {
    error.value = "The identifier must start with a lowercase letter and contain only letters and digits";
    return;
  }
  if (!URL.canParse(cardUrl.value.trim()) || !["http:", "https:"].includes(new URL(cardUrl.value.trim()).protocol)) {
    error.value = "Please enter a valid HTTP or HTTPS Agent Card URL";
    return;
  }
  saving.value = true;
  try {
    const { data } = await axios.post("/api/agents/connect", {
      name: name.value.trim(), cardUrl: cardUrl.value.trim(), ...(token.value.trim() ? { token: token.value.trim() } : {}),
    }, { headers: { "x-toonflow-workspace": "1" } });
    if (data.code !== 200) throw new Error(data.message || "Connection failed");
    emit("saved");
    ElMessage.success("Remote agent connected");
    visible.value = false;
  } catch (cause) {
    error.value = axios.isAxiosError(cause) ? cause.response?.data?.message || cause.message : cause instanceof Error ? cause.message : "Connection failed";
  } finally { saving.value = false; }
}
</script>
