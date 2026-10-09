import axios from "axios";
import { ElMessage } from "element-plus";

const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "1";

export default async function saveFile(content: Blob | (() => Promise<Blob>), fileName: string): Promise<boolean> {
  if (isDesktop) {
    const { data: selectData } = await axios.post<{ code: number; data: { token: string | null }; message?: string }>(
      "/api/desktop/selectSaveFile",
      { fileName },
      { headers: { "x-toonflow-desktop": "1" } },
    );
    if (selectData.code !== 200) throw new Error(selectData.message || "Failed to select save location");
    const token = selectData.data?.token;
    if (!token) return false;
    const blob = typeof content === "function" ? await content() : content;
    const { data } = await axios.post<{ code: number; data: { saved: boolean }; message?: string }>("/api/desktop/saveFile", blob, {
      params: { token },
      headers: { "Content-Type": "application/octet-stream", "x-toonflow-desktop": "1" },
    });
    if (data.code !== 200 || typeof data.data?.saved !== "boolean") throw new Error(data.message || "Failed to save file");
    return data.data.saved;
  }
  const blob = typeof content === "function" ? await content() : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export function registerDesktopDownloads() {
  const pending = new WeakSet<HTMLAnchorElement>();
  function handleDownload(event: MouseEvent) {
    const link = event.composedPath().find(element => element instanceof HTMLAnchorElement && element.hasAttribute("download")) as HTMLAnchorElement | undefined;
    if (!link?.href || event.button !== 0) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || !["blob:", "http:", "https:"].includes(url.protocol)) return;
    event.preventDefault();
    if (pending.has(link) || link.getAttribute("aria-disabled") === "true") return;
    pending.add(link);
    link.dispatchEvent(new CustomEvent("downloadstate", { detail: true }));
    // ACT: Intercept downloads in capture phase, compatible with installed nodes' @click.stop, no need to re-bundle nodes; select save location first, then fetch content after confirmation.
    void saveFile(() => axios.get<Blob>(url.href, { responseType: "blob" }).then(({ data }) => data), link.download || "download").catch(error => {
      ElMessage.error(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "Failed to save file");
    }).finally(() => {
      pending.delete(link);
      link.dispatchEvent(new CustomEvent("downloadstate", { detail: false }));
    });
  }
  if (isDesktop) document.addEventListener("click", handleDownload, true);
  return () => document.removeEventListener("click", handleDownload, true);
}
