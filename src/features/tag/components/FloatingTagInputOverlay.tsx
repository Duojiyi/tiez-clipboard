import { useLayoutEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import FloatingTagInput from "./FloatingTagInput";
import type { ClipboardEntry } from "../../../shared/types";

/** 内置敏感标签别名，与列表隐私判定保持一致，作为建议来源之一 */
const BUILTIN_TAG_SUGGESTIONS = ["sensitive", "密码", "password"] as const;

interface FloatingTagInputOverlayProps {
  /** 锚定条目的 id（对应 DOM 元素 id `clipboard-item-${anchorId}`） */
  anchorId: number;
  /** 当前可见历史，用于读取锚定条目已有标签与汇总建议 */
  history: ClipboardEntry[];
  t: (key: string) => string;
  theme: string;
  tagColors?: Record<string, string>;
  onSubmit: (tag: string) => void;
  onClose: () => void;
}

/**
 * 浮动标签输入框的定位包装层。
 *
 * 负责把 6.1 实现的 FloatingTagInput 叠加显示在键盘焦点条目之上（需求 15.1），
 * 并汇总当前历史中的标签作为预置建议、过滤掉锚定条目已关联的标签。
 * 关闭与持久化逻辑由父级（App）通过 onClose / onSubmit 处理。
 */
export default function FloatingTagInputOverlay({
  anchorId,
  history,
  t,
  theme,
  tagColors,
  onSubmit,
  onClose
}: FloatingTagInputOverlayProps) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  // 依据锚定条目的 DOM 位置计算浮动框的固定定位坐标
  useLayoutEffect(() => {
    const anchor = document.getElementById(`clipboard-item-${anchorId}`);
    if (!anchor) {
      onClose();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setStyle({
      position: "fixed",
      left: Math.round(rect.left + 8),
      top: Math.round(rect.bottom - 28),
      zIndex: 10070
    });
  }, [anchorId, onClose]);

  // 汇总建议标签：内置敏感别名 + 历史已有标签，去重排序
  const suggestions = useMemo(() => {
    const set = new Set<string>(BUILTIN_TAG_SUGGESTIONS);
    history.forEach((item) => (item.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history]);

  // 锚定条目已有标签，用于从建议中剔除，避免重复建议
  const existingTags = useMemo(() => {
    const anchorItem = history.find((item) => item.id === anchorId);
    return anchorItem?.tags || [];
  }, [history, anchorId]);

  return (
    <FloatingTagInput
      t={t}
      theme={theme}
      suggestions={suggestions}
      existingTags={existingTags}
      tagColors={tagColors}
      onSubmit={onSubmit}
      onClose={onClose}
      style={style}
    />
  );
}
