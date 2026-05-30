/** Toast 类型：用于统一颜色与图标（成功 / 失败 / 普通信息） */
export type ToastVariant = "success" | "error" | "info";

/** 统一的 Toast 推送函数签名：消息、可选消失时长(ms)、可选类型 */
export type PushToast = (
  msg: string,
  duration?: number,
  variant?: ToastVariant
) => number;

export type ToastItem = {
  id: number;
  msg: string;
  /** 提示类型，决定 Toast 的颜色与图标；缺省按普通信息处理 */
  variant: ToastVariant;
};

export type ConfirmDialogState = {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};
