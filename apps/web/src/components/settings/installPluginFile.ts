import axios from "axios";

export async function installPluginFile(type: "node" | "tool" | "skill" | "agent" | "ext", file: File, force = false) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Please select a non-empty plugin file no larger than 20 MB");
  const payload = type === "skill" || type === "agent"
    ? { fileName: file.name, base64: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",", 2)[1]!);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }) }
    : { fileName: file.name, source: await file.text() };
  const { data } = await axios.post(`/api/${type === "ext" ? "ext" : `${type}s`}/install`, { ...payload, force }, { headers: { "x-toonflow-workspace": "1" } });
  if (data.code !== 200) throw new Error(data.message || "Failed to install plugin");
  const name = data.data?.name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Install API did not return a valid plugin name");
  window.dispatchEvent(new CustomEvent("toonflow:plugin-installed", { detail: { type, name } }));
  if (type === "ext") window.dispatchEvent(new CustomEvent("toonflow:ext-updated", { detail: { name } }));
  return name;
}
