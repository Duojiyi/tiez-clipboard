/**
 * 浮动标签输入框（F1 快速打标签）的纯逻辑。
 *
 * 将组件与键盘导航 Hook 中与渲染/副作用无关的判定抽离为纯函数，
 * 供 `FloatingTagInput.tsx` 与 `useKeyboardNavigation.ts` 复用，便于单元测试。
 */

import { normalizeTag } from "../../../shared/lib/clipboardCore";

/** 保留标签：用于标记敏感内容（需求 15.3 / F3）。 */
export const SENSITIVE_TAG = "__sensitive__";

/** 建议列表最多展示条数，与列表内联编辑器保持一致。 */
export const MAX_TAG_SUGGESTIONS = 14;

/**
 * 计算浮动标签输入框的预置标签建议（需求 15.3）。
 *
 * - 始终把保留标签 __sensitive__ 置顶并入；
 * - 去重（保持首次出现顺序）；
 * - 剔除焦点条目已关联的标签，避免重复建议；
 * - 按输入关键字（忽略大小写、去首尾空白）过滤；
 * - 最多返回 max 条。
 */
export function computeFloatingTagSuggestions(
  suggestions: string[],
  existingTags: string[],
  input: string,
  max: number = MAX_TAG_SUGGESTIONS
): string[] {
  const alreadyTagged = new Set(existingTags);
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const tag of [SENSITIVE_TAG, ...suggestions]) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    if (alreadyTagged.has(tag)) continue;
    merged.push(tag);
  }

  const keyword = input.trim().toLowerCase();
  return merged
    .filter((tag) => !keyword || tag.toLowerCase().includes(keyword))
    .slice(0, max);
}

/**
 * 是否允许打开浮动标签输入框（需求 15.1 / 15.5）。
 *
 * 仅当处于键盘导航模式且选中索引落在可见列表范围内（即确有选中条目）时才允许；
 * 未选中任何条目时按 `T` 不显示、不操作（需求 15.5）。
 */
export function canOpenFloatingTagInput(
  isKeyboardMode: boolean,
  selectedIndex: number,
  historyLength: number
): boolean {
  return isKeyboardMode && selectedIndex >= 0 && selectedIndex < historyLength;
}

/**
 * 规范化提交的标签（需求 15.2 / 15.7）。
 *
 * 去除首尾空白并截断到最大长度；若为空或纯空白则返回 null，
 * 调用方据此忽略该次回车、不创建标签且保持输入框打开（需求 15.7）。
 */
export function normalizeSubmittedTag(rawTag: string): string | null {
  const tag = normalizeTag(rawTag);
  return tag ? tag : null;
}
