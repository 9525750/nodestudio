import { createApp, h, nextTick } from "vue";
import { ElButton, ElResult } from "element-plus";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import App from "./App.vue";
import "@/assets/main.scss";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/button/style/css";
import "element-plus/es/components/result/style/css";

import router from "@/router";
import { registerDesktopProtocol } from "@/lib/desktopProtocol";
import { registerDesktopDownloads } from "@/lib/saveFile";
import { registerAnonymousData } from "@/lib/anonymousData";
import { loadSettings, settingsStorage } from "@/stores/settings";
import { checkDesktopUpdate } from "@/stores/desktopUpdate";
import { registerLanguage } from "@/lib/i18n";
import { locale, translate } from "@toonflow/i18n/vue";

const app = createApp(App);
app.onUnmount(registerLanguage());
const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "1";
const requiresWebView2Update = isDesktop && /Windows/i.test(navigator.userAgent)
  && [Map.groupBy, URL.canParse, Promise.withResolvers].some(method => typeof method !== "function");
let isMounted = false;

async function notifyDesktopReady(failed = false) {
  if (!isDesktop) return;
  const response = await fetch("/api/desktop/ready", {
    method: "POST",
    headers: { "x-toonflow-desktop": "1", "Content-Type": "application/json", "Accept-Language": locale.value },
    body: JSON.stringify({ failed }),
  });
  if (!response.ok) throw new Error((await response.json()).message || `Failed to notify desktop ready (${response.status})`);
}

// ACT: Auto-updates of installed clients do not go through NSIS; at startup, block old WebView2 versions missing required APIs from entering business pages.
(requiresWebView2Update
  ? Promise.reject(new Error("The Microsoft Edge WebView2 Runtime version is too old. Run the latest Microsoft installer as administrator; if it still says it is installed, repair WebView2 or contact your administrator to check the update service. After updating, fully quit Toonflow and reopen it."))
  : loadSettings()).then(async () => {
  app.use(createPinia().use(createPersistedState({ storage: settingsStorage })));
  app.use(router);
  await router.isReady();
  app.onUnmount(registerAnonymousData());
  app.mount("#app");
  isMounted = true;
  if (!isDesktop) return;
  app.onUnmount(registerDesktopProtocol());
  app.onUnmount(registerDesktopDownloads());
  await nextTick();
  // ACT: A hidden WebView does not rely on requestAnimationFrame; wait for the home page to mount and page resources to be ready.
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
  }
  await notifyDesktopReady();
  // ACT: Check silently once after desktop startup; on failure leave it for the user to retry manually, without blocking startup or auto-downloading.
  void checkDesktopUpdate(true).catch(() => {});
}).catch(async (error) => {
  console.error("Page initialization failed:", error);
  if (isMounted) app.unmount();
  createApp({
    render: () => h(ElResult, {
      icon: "error",
      title: requiresWebView2Update ? translate("需要更新 WebView2") : translate("启动失败"),
      subTitle: error instanceof Error ? error.message : translate("无法加载应用，请重试。"),
    }, {
      extra: () => h(ElButton, {
        type: "primary",
        onClick: () => requiresWebView2Update
          ? window.open("https://developer.microsoft.com/microsoft-edge/webview2/#download", "_blank")
          : window.location.reload(),
      }, () => requiresWebView2Update ? translate("前往微软官网更新") : translate("重试")),
    }),
  }).mount("#app");
  await nextTick();
  // ACT: The error page must also end the startup animation, but must not consume install requests whose listener is not yet registered.
  await notifyDesktopReady(true).catch((error) => console.error("Failed to show startup error page:", error));
});
