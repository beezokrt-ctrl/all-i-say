export async function registerOffline(
  onState,
  { serviceWorker = globalThis.navigator?.serviceWorker, secure = globalThis.isSecureContext } = {},
) {
  if (!secure || !serviceWorker) {
    onState("unsupported");
    return;
  }
  onState("installing");
  try {
    const registration = await serviceWorker.register(new URL("../../sw.js", import.meta.url), {
      updateViaCache: "none",
    });
    const report = () => {
      if (registration.waiting) onState("update-ready");
      else if (registration.active) onState("ready");
      else if (registration.installing?.state === "redundant") onState("unavailable");
      else onState("installing");
    };
    const watch = () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "redundant" && !registration.active) onState("unavailable");
        else report();
      });
      report();
    };
    registration.addEventListener("updatefound", watch);
    serviceWorker.addEventListener("controllerchange", report);
    watch();
    return registration;
  } catch {
    onState("unavailable");
  }
}

export const offlineStatusText = {
  installing: "Preparing offline access. Keep this page open for a moment.",
  ready: "Ready for offline use.",
  "update-ready":
    "Ready for offline use. An update is waiting: finish saving, close all All I Say windows, then reopen.",
  unsupported: "Offline setup needs a supported browser and a secure website address.",
  unavailable: "Offline setup could not finish. Reopen this page while connected to try again.",
};
