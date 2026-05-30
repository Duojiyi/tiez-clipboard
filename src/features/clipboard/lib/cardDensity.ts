/**
 * 卡片密度（V5 / 需求 32）相关的纯逻辑。
 *
 * 将「密度档位 → 条目高度 itemHeight」映射与「虚拟列表重算键」生成抽离为纯函数，
 * 供 VirtualClipboardList 复用并单独测试。密度切换时高度发生变化、且重算键随之改变，
 * 从而强制 Virtuoso 重挂载、全量重算行高，保证虚拟列表渲染正确（需求 32.3）。
 */

import type { CardDensity } from "../../app/types";

/**
 * 各密度档位对应的条目基准高度（px）。
 * 紧凑 < 标准 < 宽松，三档互不相同（需求 32.2）。
 * 数值与 compact-mode.css 中各档 padding/行数的相对密集程度一致。
 */
const DENSITY_ITEM_HEIGHT: Record<CardDensity, number> = {
  compact: 56,
  standard: 72,
  loose: 96,
};

/** 将密度档位映射为条目基准高度（px）（需求 32.2/32.3）。 */
export function densityItemHeight(density: CardDensity): number {
  return DENSITY_ITEM_HEIGHT[density];
}

/**
 * 生成虚拟列表的重挂载键（需求 32.3）。
 *
 * 密度或紧凑模式变化时键随之改变，作为 Virtuoso 的 `key`，
 * 触发重挂载与行高全量重算（仅靠 CSS 改变高度不会刷新 Virtuoso 已缓存的行高偏移）。
 */
export function densityListKey(density: CardDensity, compactMode: boolean): string {
  return `density-${density}-${compactMode ? "compact" : "normal"}`;
}
