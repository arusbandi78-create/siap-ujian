import { useEffect, useRef } from "react";

export type ViolationType = "tab_hidden" | "window_blur" | "exit_fullscreen" | "navigation" | "page_exit";

/**
 * Exam Mode monitor: Page Visibility, blur/focus, fullscreen exit, back navigation.
 * Coalesces near-simultaneous events (e.g. blur + hidden) into one violation.
 */
export function useExamGuard(active: boolean, onViolation: (t: ViolationType) => void, requireFullscreen: boolean) {
  const cb = useRef(onViolation);
  cb.current = onViolation;
  const last = useRef(0);

  useEffect(() => {
    if (!active) return;
    const fire = (t: ViolationType) => {
      const now = Date.now();
      if (now - last.current < 2000) return;
      last.current = now;
      cb.current(t);
    };
    const onVis = () => document.visibilityState === "hidden" && fire("tab_hidden");
    const onBlur = () => {
      // Focusing the embedded player is not leaving the exam. Visibility/pagehide
      // still suspend tab switching, and real window blur remains monitored.
      setTimeout(() => {
        if (document.hasFocus() && document.visibilityState === "visible" && document.activeElement instanceof HTMLIFrameElement && document.activeElement.dataset['examMedia'] === "youtube") return;
        fire("window_blur");
      }, 0);
    };
    const onFs = () => requireFullscreen && !document.fullscreenElement && fire("exit_fullscreen");
    const block = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "p", "s", "u"].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === "F12" || e.key === "PrintScreen") e.preventDefault();
    };
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onHide = () => fire("page_exit");
    history.pushState(null, "", location.href);
    const onPop = () => { history.pushState(null, "", location.href); fire("navigation"); };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("popstate", onPop);
    };
  }, [active, requireFullscreen]);
}

export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}
export async function exitFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
}
