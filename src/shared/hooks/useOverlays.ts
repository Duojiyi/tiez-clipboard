import { useCallback, useState } from "react";
import type { ConfirmDialogState, ToastItem, ToastVariant } from "../types";

const emptyConfirm: ConfirmDialogState = {
  show: false,
  title: "",
  message: "",
  onConfirm: () => {}
};

export const useOverlays = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(emptyConfirm);

  // 统一推送 Toast：variant 控制颜色/图标（success/error/info），缺省为 info。
  // duration 缺省 3000ms，与设计中统一的消失时长一致；duration<=0 表示常驻不自动消失。
  const pushToast = useCallback(
    (msg: string, duration = 3000, variant: ToastVariant = "info") => {
      // 用自增计数避免同毫秒多次推送产生重复 key
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, msg, variant }]);
      if (duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
      return id;
    },
    []
  );

  const openConfirm = useCallback(
    (opts: { title: string; message: string; onConfirm: () => void }) => {
      setConfirmDialog({
        show: true,
        title: opts.title,
        message: opts.message,
        onConfirm: opts.onConfirm
      });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, show: false }));
  }, []);

  return {
    toasts,
    pushToast,
    confirmDialog,
    openConfirm,
    closeConfirm
  };
};
