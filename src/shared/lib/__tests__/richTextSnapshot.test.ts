import { describe, it, expect } from "vitest";
import { LruStringCache } from "../lruCache";

/**
 * richTextSnapshot LRU 缓存上限单元测试（任务 21.3 / 需求 22.1、22.2）。
 *
 * 被测：richTextSnapshot.ts 富文本快照缓存所复用的有界 LRU 实现（lruCache.ts）。
 * richTextSnapshot 模块在运行时依赖浏览器 DOMParser，无法在 node 环境直接加载，
 * 因此对其缓存淘汰行为通过其复用的 LruStringCache 进行验证：
 * - 缓存超过上限时淘汰最久未使用（最旧）项（LRU，需求 22.2）；
 * - 命中读取会刷新使用顺序，避免长时间运行内存无界增长（需求 22.1）。
 */

describe("LruStringCache — 超上限淘汰最旧项（需求 22.2）", () => {
  it("写入未超上限时不淘汰任何项", () => {
    const cache = new LruStringCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.size).toBe(3);
    expect(cache.keysInOrder()).toEqual(["a", "b", "c"]);
  });

  it("写入超过上限时淘汰最旧（队首）项", () => {
    const cache = new LruStringCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4"); // 超上限，淘汰最旧的 a

    expect(cache.size).toBe(3);
    expect(cache.has("a")).toBe(false);
    expect(cache.keysInOrder()).toEqual(["b", "c", "d"]);
  });

  it("连续超限写入时持续淘汰最旧项，容量恒定不超上限", () => {
    const cache = new LruStringCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4");

    expect(cache.size).toBe(2);
    expect(cache.keysInOrder()).toEqual(["c", "d"]);
  });
});

describe("LruStringCache — 命中读取刷新使用顺序（LRU，需求 22.1）", () => {
  it("读取命中后该项被标记为最近使用，淘汰时优先保留", () => {
    const cache = new LruStringCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");

    // 命中读取 a：a 移到队尾，最旧变为 b
    expect(cache.get("a")).toBe("1");

    cache.set("d", "4"); // 超上限，淘汰最旧的 b（而非 a）
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.keysInOrder()).toEqual(["c", "a", "d"]);
  });

  it("重复写入同一 key 视为更新且刷新到最新，不增加容量", () => {
    const cache = new LruStringCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "1-new"); // 更新 a，移到队尾

    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe("1-new");
    expect(cache.keysInOrder()).toEqual(["b", "a"]);
  });

  it("未命中读取返回 undefined 且不改变缓存内容", () => {
    const cache = new LruStringCache(2);
    cache.set("a", "1");
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.keysInOrder()).toEqual(["a"]);
  });
});

describe("LruStringCache — 构造校验", () => {
  it("非正整数容量上限抛错", () => {
    expect(() => new LruStringCache(0)).toThrow();
    expect(() => new LruStringCache(-1)).toThrow();
  });

  it("暴露容量上限以供调用方查询", () => {
    expect(new LruStringCache(240).capacity).toBe(240);
  });
});
