import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import type { ComponentType } from "react";
import type { ToastItem, ToastVariant } from "../types";

interface ToastContainerProps {
  toasts: ToastItem[];
}

// 各类型对应的 lucide 图标，保证成功/失败/信息三类视觉统一
const VARIANT_ICON: Record<ToastVariant, ComponentType<{ size?: number }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
};

const ToastContainer = ({ toasts }: ToastContainerProps) => (
  <div className="toast-container">
    <AnimatePresence>
      {toasts.map((toast) => {
        const variant: ToastVariant = toast.variant ?? "info";
        const Icon = VARIANT_ICON[variant];
        return (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`toast-item toast-${variant}`}
            role="status"
          >
            <Icon size={16} />
            <span className="toast-msg">{toast.msg}</span>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

export default ToastContainer;
