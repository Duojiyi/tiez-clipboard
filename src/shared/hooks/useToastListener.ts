import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { PushToast, ToastVariant } from "../types";

interface UseToastListenerOptions {
  pushToast: PushToast;
}

// "toast" 事件的载荷：兼容纯字符串（旧用法）与带类型的结构体（统一颜色/图标）
type ToastEventPayload = string | { msg: string; variant?: ToastVariant };

export const useToastListener = ({ pushToast }: UseToastListenerOptions) => {
  useEffect(() => {
    const unlistenToast = listen<ToastEventPayload>("toast", (event) => {
      const payload = event.payload;
      if (typeof payload === "string") {
        pushToast(payload, 3000, "info");
      } else {
        pushToast(payload.msg, 3000, payload.variant ?? "info");
      }
    });
    return () => {
      unlistenToast.then((f) => f());
    };
  }, [pushToast]);
};
