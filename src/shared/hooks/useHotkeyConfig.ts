import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type HotkeyMode = "main" | "sequential" | "rich" | "search" | "sensitive";

/** 快捷键作用域（与后端 HotkeyScope 枚举一一对应）。 */
export type HotkeyScope = "Global" | "InAppOnly" | "BackgroundOnly";

/** 需求 19 涉及的可配置作用域的快捷键 id（与后端 `app.hotkey.scope.<id>` 的 id 对齐）。 */
export const SCOPED_HOTKEY_IDS: HotkeyMode[] = ["main", "sequential", "rich", "search"];

interface UseHotkeyConfigOptions {
  hotkey: string;
  setHotkey: (val: string) => void;
  sequentialHotkey: string;
  setSequentialHotkey: (val: string) => void;
  richPasteHotkey: string;
  setRichPasteHotkey: (val: string) => void;
  searchHotkey: string;
  setSearchHotkey: (val: string) => void;
  sensitiveHotkey: string;
  setSensitiveHotkey: (val: string) => void;
  sequentialMode: boolean;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  isRecordingSequential: boolean;
  setIsRecordingSequential: (val: boolean) => void;
  isRecordingRich: boolean;
  setIsRecordingRich: (val: boolean) => void;
  isRecordingSearch: boolean;
  setIsRecordingSearch: (val: boolean) => void;
  isRecordingSensitive: boolean;
  setIsRecordingSensitive: (val: boolean) => void;
  saveAppSetting: (type: string, value: string) => void;
  t: (key: string) => string;
  pushToast: (msg: string, duration?: number) => number;
}

export const useHotkeyConfig = ({
  hotkey,
  setHotkey,
  sequentialHotkey,
  setSequentialHotkey,
  richPasteHotkey,
  setRichPasteHotkey,
  searchHotkey,
  setSearchHotkey,
  sensitiveHotkey,
  setSensitiveHotkey,
  sequentialMode,
  isRecording,
  setIsRecording,
  isRecordingSequential,
  setIsRecordingSequential,
  isRecordingRich,
  setIsRecordingRich,
  isRecordingSearch,
  setIsRecordingSearch,
  isRecordingSensitive,
  setIsRecordingSensitive,
  saveAppSetting,
  t,
  pushToast
}: UseHotkeyConfigOptions) => {
  const checkHotkeyConflict = useCallback(
    (newHotkey: string, mode: HotkeyMode): boolean => {
      if (!newHotkey) return false;

      const conflicts = [];
      if (mode !== "main" && newHotkey === hotkey) conflicts.push(t("global_hotkey"));
      if (mode !== "sequential" && sequentialMode && newHotkey === sequentialHotkey) {
        conflicts.push(t("sequential_paste_hotkey_label"));
      }
      if (mode !== "rich" && newHotkey === richPasteHotkey) {
        conflicts.push(t("rich_paste_hotkey_label"));
      }
      if (mode !== "search" && newHotkey === searchHotkey) {
        conflicts.push(t("search_hotkey_label"));
      }
      if (mode !== "sensitive" && newHotkey === sensitiveHotkey) {
        conflicts.push(t("sensitive_hotkey_label"));
      }

      if (conflicts.length > 0) {
        const msg = t("hotkey_conflict_toast").replace("{name}", conflicts[0]);
        pushToast(msg, 5000);
        return true;
      }
      return false;
    },
    [hotkey, sequentialMode, sequentialHotkey, richPasteHotkey, searchHotkey, sensitiveHotkey, t, pushToast]
  );

  const updateHotkey = useCallback(
    async (newHotkey: string) => {
      const hasConflict = checkHotkeyConflict(newHotkey, "main");
      if (hasConflict) {
        setIsRecording(false);
        return;
      }

      if (newHotkey) {
        try {
          await invoke<boolean>("test_hotkey_available", { hotkey: newHotkey });
        } catch (err) {
          const errorMsg = `❌ ${newHotkey}: ${err || "快捷键被占用"}`;
          pushToast(errorMsg, 5000);
          setIsRecording(false);
          return;
        }
      }

      setHotkey(newHotkey);
      saveAppSetting("hotkey", newHotkey);
      await invoke("register_hotkey", { hotkey: newHotkey }).catch((err) => {
        if (newHotkey) {
          const errorMsg = t("hotkey_register_failed") + (err?.toString() || "");
          pushToast(errorMsg, 3000);
        }
      });
      setIsRecording(false);
    },
    [checkHotkeyConflict, pushToast, saveAppSetting, setHotkey, setIsRecording, t]
  );

  const updateSequentialHotkey = useCallback(
    async (newHotkey: string) => {
      const hasConflict = checkHotkeyConflict(newHotkey, "sequential");
      if (hasConflict) {
        setIsRecordingSequential(false);
        return;
      }

      if (newHotkey) {
        try {
          await invoke<boolean>("test_hotkey_available", { hotkey: newHotkey });
        } catch (err) {
          const errorMsg = `❌ ${newHotkey}: ${err || "快捷键被占用"}`;
          pushToast(errorMsg, 5000);
          setIsRecordingSequential(false);
          return;
        }
      }

      setSequentialHotkey(newHotkey);
      saveAppSetting("sequential_hotkey", newHotkey);
      await invoke("set_sequential_hotkey", { hotkey: newHotkey }).catch(console.error);
      setIsRecordingSequential(false);
    },
    [
      checkHotkeyConflict,
      pushToast,
      saveAppSetting,
      setSequentialHotkey,
      setIsRecordingSequential
    ]
  );

  const updateRichPasteHotkey = useCallback(
    async (newHotkey: string) => {
      const hasConflict = checkHotkeyConflict(newHotkey, "rich");
      if (hasConflict) {
        setIsRecordingRich(false);
        return;
      }

      if (newHotkey) {
        try {
          await invoke<boolean>("test_hotkey_available", { hotkey: newHotkey });
        } catch (err) {
          const errorMsg = `❌ ${newHotkey}: ${err || "快捷键被占用"}`;
          pushToast(errorMsg, 5000);
          setIsRecordingRich(false);
          return;
        }
      }

      setRichPasteHotkey(newHotkey);
      saveAppSetting("rich_paste_hotkey", newHotkey);
      await invoke("set_rich_paste_hotkey", { hotkey: newHotkey }).catch(console.error);
      setIsRecordingRich(false);
    },
    [
      checkHotkeyConflict,
      pushToast,
      saveAppSetting,
      setRichPasteHotkey,
      setIsRecordingRich
    ]
  );

  const updateSearchHotkey = useCallback(
    async (newHotkey: string) => {
      const hasConflict = checkHotkeyConflict(newHotkey, "search");
      if (hasConflict) {
        setIsRecordingSearch(false);
        return;
      }

      if (newHotkey) {
        try {
          await invoke<boolean>("test_hotkey_available", { hotkey: newHotkey });
        } catch (err) {
          const errorMsg = `❌ ${newHotkey}: ${err || "快捷键被占用"}`;
          pushToast(errorMsg, 5000);
          setIsRecordingSearch(false);
          return;
        }
      }

      setSearchHotkey(newHotkey);
      saveAppSetting("search_hotkey", newHotkey);
      await invoke("set_search_hotkey", { hotkey: newHotkey }).catch(console.error);
      setIsRecordingSearch(false);
    },
    [
      checkHotkeyConflict,
      pushToast,
      saveAppSetting,
      setSearchHotkey,
      setIsRecordingSearch
    ]
  );

  // 敏感标记快捷键（需求 17.3）：Scope=InAppOnly，仅由 webview keydown 响应、不进行全局注册，
  // 因此只做冲突校验 + 持久化 + 更新状态，无需调用后端注册命令。
  const updateSensitiveHotkey = useCallback(
    async (newHotkey: string) => {
      const hasConflict = checkHotkeyConflict(newHotkey, "sensitive");
      if (hasConflict) {
        setIsRecordingSensitive(false);
        return;
      }

      setSensitiveHotkey(newHotkey);
      saveAppSetting("sensitive_hotkey", newHotkey);
      setIsRecordingSensitive(false);
    },
    [
      checkHotkeyConflict,
      saveAppSetting,
      setSensitiveHotkey,
      setIsRecordingSensitive
    ]
  );

  // 更改单个快捷键的作用域（需求 19.5 / 19.9）：
  // 持久化 `app.hotkey.scope.<id>`，再触发后端按新作用域重新分流注册，1 秒内生效。
  const updateHotkeyScope = useCallback(
    async (id: HotkeyMode, scope: HotkeyScope) => {
      saveAppSetting(`hotkey.scope.${id}`, scope);
      await invoke("sync_hotkeys").catch(console.error);
    },
    [saveAppSetting]
  );

  // 恢复默认：将所有快捷键作用域还原为默认值（既有快捷键默认 Global，需求 19.6），
  // 重新分流后给出成功反馈。
  const resetHotkeyScopes = useCallback(async () => {
    SCOPED_HOTKEY_IDS.forEach((id) => {
      saveAppSetting(`hotkey.scope.${id}`, "Global");
    });
    await invoke("sync_hotkeys").catch(console.error);
    pushToast(t("hotkey_scope_reset_success"), 3000);
  }, [saveAppSetting, pushToast, t]);


  useEffect(() => {
    invoke("set_recording_mode", {
      enabled: isRecording || isRecordingSequential || isRecordingRich
        || isRecordingSearch || isRecordingSensitive
    }).catch(console.error);

    if (isRecording || isRecordingSequential || isRecordingRich || isRecordingSearch || isRecordingSensitive) {
      const unlisten = listen<string>("hotkey-recorded", (event) => {
        if (isRecording) updateHotkey(event.payload);
        if (isRecordingSequential) updateSequentialHotkey(event.payload);
        if (isRecordingRich) updateRichPasteHotkey(event.payload);
        if (isRecordingSearch) updateSearchHotkey(event.payload);
        if (isRecordingSensitive) updateSensitiveHotkey(event.payload);
      });

      const unlistenCancel = listen("recording-cancelled", () => {
        setIsRecording(false);
        setIsRecordingSequential(false);
        setIsRecordingRich(false);
        setIsRecordingSearch(false);
        setIsRecordingSensitive(false);
      });

      return () => {
        unlisten.then((f) => f());
        unlistenCancel.then((f) => f());
      };
    }
  }, [
    isRecording,
    isRecordingSequential,
    isRecordingRich,
    isRecordingSearch,
    isRecordingSensitive,
    setIsRecording,
    setIsRecordingSequential,
    setIsRecordingRich,
    setIsRecordingSearch,
    setIsRecordingSensitive,
    updateHotkey,
    updateSequentialHotkey,
    updateRichPasteHotkey,
    updateSearchHotkey,
    updateSensitiveHotkey
  ]);

  return {
    checkHotkeyConflict,
    updateHotkey,
    updateSequentialHotkey,
    updateRichPasteHotkey,
    updateSearchHotkey,
    updateSensitiveHotkey,
    updateHotkeyScope,
    resetHotkeyScopes
  };
};
