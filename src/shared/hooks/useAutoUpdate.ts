import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "../lib/tauriRuntime";

export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "error";

// 启动后多久触发首次自动检查更新（毫秒）
const STARTUP_CHECK_DELAY_MS = 5000;

export const useAutoUpdate = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateObj, setUpdateObj] = useState<Update | null>(null);

  const checkUpdate = useCallback(async () => {
    if (!isTauriRuntime()) return;
    
    try {
      setStatus("checking");
      
      const update = await check({
        proxy: undefined,
        headers: { "Cache-Control": "no-cache" },
        timeout: 10000
      });

      if (update) {
        console.log(`[Update] New version detected: ${update.version}`);
        setUpdateObj(update);
        setVersion(update.version);
        setNotes(update.body || "");
        setIsOpen(true);
      } else {
        // No update found, emit an event so the UI can show "Up to date"
        import('@tauri-apps/api/event').then(({ emit }) => {
          emit("update-not-available");
        });
      }
      
      setStatus("idle");
    } catch (error) {
      console.error("[Update] Failed to check for updates:", error);
      setStatus("error");
    }
  }, []);

  const startUpdate = async () => {
    if (!updateObj) return;

    try {
      setStatus("downloading");
      setDownloadProgress(0);

      await updateObj.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            console.log("[Update] Download started");
            break;
          case "Progress":
            setDownloadProgress((prev) => Math.min(prev + 5, 99));
            break;
          case "Finished":
            console.log("[Update] Download finished");
            setDownloadProgress(100);
            setStatus("ready");
            break;
        }
      });
      
      setStatus("ready");
      setDownloadProgress(100);
    } catch (error) {
      console.error("[Update] Failed to download or install update:", error);
      setStatus("error");
    }
  };

  const applyUpdate = async () => {
    try {
      await relaunch();
    } catch (error) {
      console.error("[Update] Failed to relaunch:", error);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // 读取设置：默认开启启动检查（与历史行为一致）
    const scheduleStartupCheck = async () => {
      if (!isTauriRuntime()) return;

      try {
        const settings = await invoke<Record<string, string>>("get_settings");
        if (cancelled) return;

        // app.check_update_on_startup === "false" 时关闭，其它（"true" / undefined）都视为开启
        const enabled = settings["app.check_update_on_startup"] !== "false";
        if (!enabled) return;
      } catch {
        // 读不到设置时按历史行为继续检查
      }

      timer = setTimeout(() => {
        checkUpdate();
      }, STARTUP_CHECK_DELAY_MS);
    };

    scheduleStartupCheck();

    const setupListener = async () => {
      if (isTauriRuntime()) {
        const { listen } = await import('@tauri-apps/api/event');
        return listen("check-update-manually", () => {
          checkUpdate();
        });
      }
      return () => {};
    };

    let unlisten: (() => void) | undefined;
    setupListener().then(fn => { unlisten = fn; });
    
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unlisten) unlisten();
    };
  }, [checkUpdate]);

  return {
    isOpen,
    status,
    version,
    notes,
    downloadProgress,
    onManualUpdate: checkUpdate,
    onStartDownload: startUpdate,
    onApplyUpdate: applyUpdate,
    onClose: () => setIsOpen(false),
  };
};
