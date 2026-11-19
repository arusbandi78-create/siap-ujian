// Single guarded registrar for the app service worker (/sw.js).
// Never registers in dev, iframes, or Lovable preview hosts; ?sw=off unregisters.
const SW_URL = "/sw.js";

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  const hosts = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
  if (hosts.some((d) => h === d || h.endsWith("." + d))) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterApp() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith(SW_URL)))
      .map((r) => r.unregister()),
  );
}

export async function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (refused()) { await unregisterApp(); return; }
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch { /* ignore */ }
}
