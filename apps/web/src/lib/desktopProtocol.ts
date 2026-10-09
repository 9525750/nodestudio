import axios from "axios";
import { t, translate } from "@toonflow/i18n/vue";
import { h } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";
import type { PluginInstallRequest, PluginInstallType } from "@toonflow/server/desktop";

declare global {
  interface WindowEventMap {
    "toonflow:install-plugin": CustomEvent<PluginInstallRequest>;
    "toonflow:plugin-installed": CustomEvent<{ type: PluginInstallType; name: string }>;
  }
}

export function registerDesktopProtocol() {
  const labels = { node: "Node", ext: "File extension", tool: "Tool", skill: "Skill", provider: "Provider", agent: "Agent" };
  const pending = new Set<string>();
  let queue = Promise.resolve();

  const handleInstall = (event: WindowEventMap["toonflow:install-plugin"]) => {
    const request = event.detail;
    if (!request || !Object.hasOwn(labels, request.type) || typeof request.url !== "string" || typeof request.fileName !== "string") return;
    const key = `${request.type}:${request.url}`;
    if (pending.has(key)) return;
    if (pending.size >= 20) {
      ElMessage.warning("Too many pending install requests, please try again later");
      return;
    }
    pending.add(key);
    queue = queue.then(() => confirmInstall(request)).catch(error => {
      ElMessage.error(error instanceof Error ? error.message : "Failed to install plugin");
    }).finally(() => pending.delete(key));
  };
  window.addEventListener("toonflow:install-plugin", handleInstall);

  async function confirmInstall(request: PluginInstallRequest) {
    const confirmed = await ElMessageBox.confirm(
      h("div", { style: { overflowWrap: "anywhere" } }, [
        h("p", `${labels[request.type]}: ${request.fileName}`),
        h("p", { style: { maxHeight: "120px", overflow: "auto", fontSize: "12px", color: "var(--el-text-color-secondary)" } }, request.url),
        h("p", translate("插件可能执行代码并访问本地文件，请仅安装信任来源的插件。")),
      ]),
      "Install plugin",
      { confirmButtonText: "Confirm install", cancelButtonText: "Cancel", closeOnClickModal: false },
    ).then(() => true, () => false);
    if (!confirmed) return;

    const loading = ElMessage({ message: "Installing plugin…", duration: 0 });
    try {
      const { data } = await axios.post("/api/desktop/plugins/install", { type: request.type, url: request.url }, {
        headers: { "x-toonflow-desktop": "1" },
        timeout: 60000,
      });
      if (data?.code !== 200) throw new Error(typeof data?.message === "string" && data.message.trim() ? data.message : "The install API returned an invalid response, please restart or update Toonflow and try again");
      if (typeof data.data?.name !== "string" || !data.data.name.trim()) throw new Error("The install API did not return a valid plugin name, please check the plugin list first and then try again");
      if (request.type === "provider") invalidateNodeModels("media");
      window.dispatchEvent(new CustomEvent("toonflow:plugin-installed", { detail: { type: request.type, name: data.data.name } }));
      if (request.type === "ext") window.dispatchEvent(new CustomEvent("toonflow:ext-updated", { detail: { name: data.data.name } }));
      ElMessage({ type: "success", message: `${labels[request.type]} installed` });
    } catch (error) {
      let message = error instanceof Error ? error.message : translate("安装失败，请稍后重试");
      if (axios.isAxiosError(error)) {
        const response = error.response;
        const data = response?.data;
        if (typeof data?.message === "string" && data.message.trim()) {
          message = data.message;
          if (Array.isArray(data.data) && data.data.every((item: unknown) => typeof item === "string")) message += `: ${data.data.join("; ")}`;
        } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
          message = translate("安装请求等待超时，请先查看插件是否已安装，再重试");
        } else if (!response) {
          message = translate("无法连接 Toonflow 本机服务，请确认应用正常运行后重试");
        } else {
          message = t`安装接口返回异常（HTTP ${response.status}），请重启或更新 Toonflow 后重试`;
        }
      }
      ElMessage({ type: "error", message: `Failed to install ${labels[request.type]} "${request.fileName}": ${message}`, duration: 10000, showClose: true });
    } finally {
      loading.close();
    }
  }
  return () => window.removeEventListener("toonflow:install-plugin", handleInstall);
}
