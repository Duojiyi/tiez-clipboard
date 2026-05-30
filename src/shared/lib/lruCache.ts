/**
 * 基于插入顺序的字符串 LRU 缓存（C3 内存收口 / 需求 22）。
 *
 * 利用 Map 保持插入顺序的特性实现 LRU：队首为最久未使用，队尾为最近使用。
 * 写入或命中读取时把条目移到队尾，超出容量上限时淘汰队首的最旧条目，
 * 从而为 richTextSnapshot 缓存提供有界容量、避免长时间运行内存无界增长。
 */
export class LruStringCache {
  private readonly map = new Map<string, string>();

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("LRU 容量上限必须为正整数");
    }
  }

  /** 当前缓存条目数。 */
  get size(): number {
    return this.map.size;
  }

  /** 容量上限。 */
  get capacity(): number {
    return this.limit;
  }

  /** 读缓存：命中时把条目移到队尾标记为最近使用；未命中返回 undefined。 */
  get(key: string): string | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** 是否包含指定 key（不更新使用顺序）。 */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** 写缓存：插入到队尾并淘汰超出上限的最旧条目。 */
  set(key: string, value: string): void {
    this.map.delete(key);
    this.map.set(key, value);
    this.trim();
  }

  /** 淘汰超出容量上限的最久未使用条目（位于队首）。 */
  private trim(): void {
    while (this.map.size > this.limit) {
      const first = this.map.keys().next();
      if (first.done) return;
      this.map.delete(first.value);
    }
  }

  /** 按从最旧到最新的顺序返回当前缓存的 key，便于测试断言淘汰行为。 */
  keysInOrder(): string[] {
    return [...this.map.keys()];
  }
}
