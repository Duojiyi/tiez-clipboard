/**
 * 剪贴板核心纯函数。
 *
 * 这些函数对应 Rust 端剪贴板捕获/去重的核心逻辑
 * （`is_empty_clipboard_content` / `dedup_key_for` / `merge_tags_union`），
 * 在前端以等价纯函数形式集中提供，供：
 * - U1 去空白：捕获判空与去重比较键生成（需求 10）；
 * - F1 快速打标签 / U2 重复合并：标签规范化与并集去重（需求 11、15）。
 *
 * 全部为无副作用纯函数，便于复用与单元测试。
 */

/** 单个标签最大长度（需求 15.2：1~50 个字符） */
export const MAX_TAG_LENGTH = 50;

/**
 * 判定剪贴板内容是否为空（需求 10.2 / 10.4 / U1）。
 *
 * 仅依据去任何空白处理前的原始长度判定：原始长度为 0 才算空。
 * 因此任意原始长度大于 0 的纯空白内容（空格、Tab、换行、回车）都不算空，
 * 应作为有效内容完整保留。
 */
export function isEmptyClipboardContent(raw: string): boolean {
  return raw.length === 0;
}

/**
 * 生成用于重复检测的比较键（需求 10.3 / 10.5 / U1）。
 *
 * 对原始内容的副本去除首尾空白并将 `\r\n` 归一为 `\n`；
 * 若去除空白后为空（纯空白内容），则回退使用原始内容作为比较键，
 * 避免不同的纯空白内容被误判为重复。
 * 不修改原始内容（纯函数，入参为不可变字符串）。
 */
export function dedupKeyFor(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return raw;
  return trimmed.replace(/\r\n/g, "\n");
}

/**
 * 规范化单个标签（需求 15.2 / F1）。
 *
 * 去除首尾空白并截断到最大长度。纯空白将规范化为空字符串，调用方据此忽略。
 */
export function normalizeTag(raw: string): string {
  return raw.trim().slice(0, MAX_TAG_LENGTH);
}

/**
 * 合并标签为并集去重（需求 11.1 / 11.3 / 11.4 / U2，以及 F1 多选打标签去重）。
 *
 * 以 `existing` 在前、`incoming` 在后的顺序合并，标签名逐字节（严格相等）比较，
 * 保持首次出现顺序，每个不同标签在结果中恰好出现一次。
 */
export function mergeTagsUnion(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of [...existing, ...incoming]) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}
