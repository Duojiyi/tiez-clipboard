import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
import { getTagColor, getTagTextColor } from "../../../shared/lib/utils";
import { MAX_TAG_LENGTH } from "../../../shared/lib/clipboardCore";
import { SENSITIVE_TAG, computeFloatingTagSuggestions } from "../lib/floatingTagLogic";

// 保留标签从纯逻辑模块统一导出，便于其他模块复用同一来源（需求 15.3 / F3）
export { SENSITIVE_TAG };

interface FloatingTagInputProps {
  /** 文案函数 */
  t: (key: string) => string;
  /** 当前主题，用于生成标签颜色 */
  theme: string;
  /** 全局已有标签，作为预置标签建议来源（保留标签 __sensitive__ 会被自动并入） */
  suggestions?: string[];
  /** 焦点条目已关联的标签，用于从建议中过滤，避免重复建议 */
  existingTags?: string[];
  /** 标签自定义颜色映射 */
  tagColors?: Record<string, string>;
  /**
   * 提交一个有效标签（已 trim、非空、长度 ≤ 50）。
   * 标签的关联持久化与输入框关闭由父级负责（见任务 6.2）。
   */
  onSubmit: (tag: string) => void;
  /** 关闭浮动输入框（Esc 或失焦触发），不创建或关联任何标签（需求 15.6） */
  onClose: () => void;
  /** 根容器附加类名，供父级在焦点条目上叠加定位 */
  className?: string;
  /** 根容器内联样式，供父级在焦点条目上叠加定位 */
  style?: CSSProperties;
}

/**
 * 浮动标签输入框组件。
 *
 * 叠加显示于焦点条目之上，用于快速为选中条目打标签：
 * - 获得焦点时展示预置标签建议，其中始终包含保留标签 __sensitive__（需求 15.3）。
 * - 按 Esc 或失去焦点时关闭且不创建任何标签（需求 15.6）。
 * - 内容为空或仅由空白字符组成时按回车被忽略，且输入框保持打开（需求 15.7）。
 *
 * 仅负责输入交互与建议展示；标签关联的持久化由父级通过 onSubmit 处理。
 */
export default function FloatingTagInput({
  t,
  theme,
  suggestions = [],
  existingTags = [],
  tagColors = {},
  onSubmit,
  onClose,
  className,
  style,
}: FloatingTagInputProps) {
  const [input, setInput] = useState("");
  // 当前高亮的建议项索引，-1 表示未选中任何建议（回车将提交输入文本）
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  // 标记是否处于中文输入法合成态，合成期间的回车不触发提交
  const composingRef = useRef(false);
  // 标记是否已经关闭/提交，避免失焦回调在父级卸载后重复触发 onClose
  const closedRef = useRef(false);

  const fieldId = useId();

  // 挂载即聚焦输入框，从而在打开瞬间就展示预置标签建议（需求 15.3）
  useEffect(() => {
    invoke("activate_window_focus").catch(console.error);
    inputRef.current?.focus();
  }, []);

  // 计算预置标签建议：保留标签置顶并入、去重、剔除已关联标签、按输入过滤（复用纯逻辑）
  const pickableSuggestions = useMemo(
    () => computeFloatingTagSuggestions(suggestions, existingTags, input),
    [suggestions, existingTags, input]
  );

  // 建议列表变化时，收敛高亮索引避免越界
  useEffect(() => {
    setActiveIndex((prev) => {
      if (pickableSuggestions.length === 0) return -1;
      if (prev < 0) return -1;
      return Math.min(prev, pickableSuggestions.length - 1);
    });
  }, [pickableSuggestions]);

  // 高亮项滚动进入可视区域
  useEffect(() => {
    if (activeIndex < 0 || !suggestionListRef.current) return;
    const row = suggestionListRef.current.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // 关闭输入框（Esc / 失焦），不创建任何标签
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };

  // 提交一个标签：交由父级关联与关闭
  const submit = (rawTag: string) => {
    const tag = rawTag.trim();
    // 空或纯空白：忽略并保持打开（需求 15.7）
    if (!tag) return;
    closedRef.current = true;
    onSubmit(tag.slice(0, MAX_TAG_LENGTH));
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }

    const count = pickableSuggestions.length;

    if (e.key === "ArrowDown" && count > 0) {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, count - 1)));
      return;
    }

    if (e.key === "ArrowUp" && count > 0) {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (prev <= 0 ? -1 : prev - 1));
      return;
    }

    if (e.key === "Enter" && !composingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      // 命中高亮建议则提交建议，否则提交输入文本（空白将被 submit 忽略）
      if (activeIndex >= 0 && activeIndex < count) {
        submit(pickableSuggestions[activeIndex]);
      } else {
        submit(input);
      }
    }
  };

  return (
    <div className={`tag-edit-anchor floating-tag-input${className ? ` ${className}` : ""}`} style={style}>
      <div className="tag-edit-input-row">
        <input
          ref={inputRef}
          type="text"
          value={input}
          maxLength={MAX_TAG_LENGTH}
          className="tag-input"
          placeholder={t("enter_tag_name")}
          aria-autocomplete="list"
          aria-controls={pickableSuggestions.length > 0 ? `floating-tag-suggest-${fieldId}` : undefined}
          aria-activedescendant={
            activeIndex >= 0 && pickableSuggestions.length > 0
              ? `floating-tag-suggest-${fieldId}-${activeIndex}`
              : undefined
          }
          style={{
            background: "var(--bg-input)",
            border: "none",
            borderRadius: "0",
            padding: "2px 6px",
            fontSize: "10px",
            color: "var(--text-primary)",
            outline: "none",
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setInput((e.target as HTMLInputElement).value);
          }}
          onChange={(e) => setInput(e.target.value)}
          onMouseDown={() => {
            invoke("activate_window_focus").catch(console.error);
          }}
          onFocus={() => {
            invoke("activate_window_focus").catch(console.error);
          }}
          onBlur={close}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="btn-icon"
          style={{ padding: "2px", height: "16px", width: "16px" }}
          // 阻止默认行为以避免点击按钮使输入框失焦从而触发关闭
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            submit(input);
          }}
        >
          <Plus size={10} />
        </button>
      </div>

      {pickableSuggestions.length > 0 && (
        <div
          ref={suggestionListRef}
          id={`floating-tag-suggest-${fieldId}`}
          className="tag-edit-suggestions-popover hide-scrollbar"
          role="listbox"
          aria-label={t("find_tags")}
          // 阻止默认行为以避免点击建议使输入框失焦从而触发关闭
          onMouseDown={(e) => e.preventDefault()}
        >
          {pickableSuggestions.map((tag, idx) => {
            const bg = tagColors[tag] || getTagColor(tag, theme);
            const fg = getTagTextColor(bg);
            return (
              <button
                key={tag}
                type="button"
                role="option"
                id={`floating-tag-suggest-${fieldId}-${idx}`}
                aria-selected={activeIndex === idx}
                className={`tag-suggest-item${activeIndex === idx ? " tag-suggest-item--active" : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={(e) => {
                  e.stopPropagation();
                  submit(tag);
                }}
              >
                <span className="tag-suggest-pill" style={{ background: bg, color: fg }}>
                  {tag}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
