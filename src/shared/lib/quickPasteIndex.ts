/**
 * 数字快捷粘贴（F2 / 需求 16，Ctrl+1~9，InAppOnly）的索引选取纯逻辑。
 *
 * 「第 N 个」按当前「过滤后可见列表」计数（需求 16.2）；
 * 可见条目少于 N 时无操作、不改状态、不报错（需求 16.3）。
 * 抽离为纯函数供 useKeyboardNavigation 复用并单独测试。
 */

/**
 * 将 `Ctrl+N`（N=1~9）对应键码解析为 1~9 的数字；非 Digit1~Digit9 返回 null。
 *
 * @param code KeyboardEvent.code，例如 "Digit1" ~ "Digit9"
 */
export function parseQuickPasteDigit(code: string): number | null {
  if (!/^Digit[1-9]$/.test(code)) return null;
  return Number(code.slice(5));
}

/**
 * 计算第 N 个可见条目的下标（从 0 起）。
 *
 * @param n 用户按下的数字 1~9（第 N 个）
 * @param visibleCount 当前过滤后可见列表的条目数
 * @returns 命中条目的下标（n-1）；若可见条目少于 N，则返回 null（不执行粘贴，需求 16.3）
 */
export function quickPasteTargetIndex(n: number, visibleCount: number): number | null {
  if (!Number.isInteger(n) || n < 1 || n > 9) return null;
  const targetIndex = n - 1;
  if (targetIndex >= visibleCount) return null;
  return targetIndex;
}
