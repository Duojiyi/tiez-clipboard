import React, { useMemo, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { VirtualClipboardList } from "../../src/features/clipboard/components/VirtualClipboardList";
import type { VirtualClipboardListHandle } from "../../src/features/clipboard/types";
import type { ClipboardEntry } from "../../src/shared/types";

// 大列表性能脚手架（C2 / 需求 21）。
// 目标：在真实浏览器中以 5000 / 20000 / 100000 条 mock 数据驱动 VirtualClipboardList 渲染，
// 供 Playwright 脚本记录滚动帧率、内存占用与搜索响应时间。
// 该脚手架仅用于 e2e 测量，不进入生产打包。

// 启用组件内的测试钩子（VirtualClipboardList 仅在该标志为真时暴露 window.__magpieVirtualList）。
(window as unknown as { __MAGPIE_TEST__?: boolean }).__MAGPIE_TEST__ = true;

/** 一组用于填充内容的关键词，使搜索过滤具有可命中的确定性子集。 */
const KEYWORDS = ["alpha", "beta", "gamma", "delta", "keyword", "magpie", "clipboard", "perf"];

/** 生成指定条数的确定性 mock 剪贴板条目，字段与 ClipboardEntry 完全一致。 */
function generateMockEntries(count: number): ClipboardEntry[] {
  const now = Date.now();
  const entries: ClipboardEntry[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const keyword = KEYWORDS[i % KEYWORDS.length];
    const content = `条目 #${i} ${keyword} 内容样本 sample-${i} 用于大列表性能测量`;
    entries[i] = {
      id: i + 1,
      content_type: "text",
      content,
      source_app: "harness",
      timestamp: now - i * 1000,
      preview: content.slice(0, 80),
      is_pinned: false,
      tags: [],
      use_count: 0,
    };
  }
  return entries;
}

/** 从 URL query 读取初始数据量，默认 5000；只接受 5000/20000/100000 三档与任意正整数。 */
function readInitialCount(): number {
  const raw = new URLSearchParams(window.location.search).get("count");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

function HarnessApp() {
  const [count, setCount] = useState<number>(readInitialCount());
  const [search, setSearch] = useState<string>("");
  const virtualListRef = useRef<VirtualClipboardListHandle | null>(null);

  // 全量 mock 数据，仅在条数变化时重建。
  const allItems = useMemo(() => generateMockEntries(count), [count]);

  // 按搜索关键词过滤（大小写不敏感的子串匹配），模拟列表搜索路径。
  const items = useMemo(() => {
    if (!search) return allItems;
    const needle = search.toLowerCase();
    return allItems.filter((item) => item.content.toLowerCase().includes(needle));
  }, [allItems, search]);

  // 简化的条目渲染，固定高度以保证虚拟化测量稳定。
  const renderItem = useCallback((item: ClipboardEntry) => {
    return (
      <div className="harness-item">
        <div className="meta">id={item.id} · {item.source_app}</div>
        <div className="content">{item.content}</div>
      </div>
    );
  }, []);

  // 暴露脚手架控制接口，供 Playwright 注入数据量与触发搜索（确定性、无需依赖 React 内部）。
  React.useEffect(() => {
    const w = window as unknown as {
      __magpieHarness?: {
        injectData: (n: number) => void;
        setSearch: (s: string) => void;
        getVisibleCount: () => number;
      };
    };
    w.__magpieHarness = {
      injectData: (n: number) => setCount(n),
      setSearch: (s: string) => setSearch(s),
      getVisibleCount: () => items.length,
    };
    return () => {
      delete w.__magpieHarness;
    };
  }, [items.length]);

  return (
    <>
      <div className="harness-toolbar">
        <input
          data-testid="harness-search"
          placeholder="搜索关键词..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="harness-status" data-testid="harness-status">
          total={count} visible={items.length}
        </span>
      </div>
      <div className="history-list-container">
        <VirtualClipboardList
          ref={virtualListRef}
          items={items}
          renderItem={renderItem}
          hasMore={false}
          isLoading={false}
          selectedIndex={-1}
          isKeyboardMode={false}
          compactMode={false}
          cardDensity="standard"
        />
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<HarnessApp />);
