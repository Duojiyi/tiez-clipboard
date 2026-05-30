import { describe, it, expect } from "vitest";
import {
  MAX_TAG_LENGTH,
  isEmptyClipboardContent,
  dedupKeyFor,
  normalizeTag,
  mergeTagsUnion,
} from "../clipboardCore";

/**
 * 剪贴板核心纯函数单元测试（任务 32.1 / C9 测试体系起步）。
 *
 * 覆盖两类核心操作：
 * - 去空白（U1，需求 10）：isEmptyClipboardContent / dedupKeyFor
 * - 标签关联（F1/U2，需求 11、15）：normalizeTag / mergeTagsUnion
 */

describe("去空白 U1 — isEmptyClipboardContent（判空仅依据原始长度，需求 10.2/10.4）", () => {
  it("空字符串判定为空", () => {
    expect(isEmptyClipboardContent("")).toBe(true);
  });

  it("纯空格不算空（原始长度 > 0）", () => {
    expect(isEmptyClipboardContent("   ")).toBe(false);
  });

  it("纯 Tab 不算空", () => {
    expect(isEmptyClipboardContent("\t\t")).toBe(false);
  });

  it("纯换行/回车不算空", () => {
    expect(isEmptyClipboardContent("\n")).toBe(false);
    expect(isEmptyClipboardContent("\r\n")).toBe(false);
  });

  it("以空白开头的代码缩进内容不算空", () => {
    expect(isEmptyClipboardContent("    const x = 1;")).toBe(false);
  });

  it("普通文本不算空", () => {
    expect(isEmptyClipboardContent("hello")).toBe(false);
  });
});

describe("去空白 U1 — dedupKeyFor（比较键生成不改原文且区分纯空白，需求 10.3/10.5）", () => {
  it("普通文本去除首尾空白后作为比较键", () => {
    expect(dedupKeyFor("  hello  ")).toBe("hello");
  });

  it("保留内部空白（仅去首尾）", () => {
    expect(dedupKeyFor("  a b\tc  ")).toBe("a b\tc");
  });

  it("将 \\r\\n 归一为 \\n", () => {
    expect(dedupKeyFor("line1\r\nline2")).toBe("line1\nline2");
  });

  it("纯空白内容回退使用原始内容作为比较键（不会变成空串）", () => {
    expect(dedupKeyFor("   ")).toBe("   ");
    expect(dedupKeyFor("\t")).toBe("\t");
  });

  it("不同的纯空白内容比较键互不相等，避免误判重复", () => {
    expect(dedupKeyFor("  ")).not.toBe(dedupKeyFor("   "));
    expect(dedupKeyFor(" ")).not.toBe(dedupKeyFor("\t"));
  });

  it("生成比较键不修改原始字符串", () => {
    const raw = "  原始内容  ";
    const before = raw;
    dedupKeyFor(raw);
    // 字符串不可变，原值应保持一致
    expect(raw).toBe(before);
  });

  it("首尾空白不同但去空白后相同的文本拥有相同比较键（视为重复）", () => {
    expect(dedupKeyFor("hello")).toBe(dedupKeyFor("  hello  "));
  });
});

describe("标签关联 F1 — normalizeTag（规范化标签，需求 15.2）", () => {
  it("去除首尾空白", () => {
    expect(normalizeTag("  工作  ")).toBe("工作");
  });

  it("纯空白规范化为空字符串（调用方据此忽略，需求 15.7）", () => {
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("\t\n")).toBe("");
  });

  it("超长标签截断到最大长度 50", () => {
    const long = "a".repeat(80);
    expect(normalizeTag(long)).toHaveLength(MAX_TAG_LENGTH);
  });

  it("保留长度恰为 50 的标签", () => {
    const exact = "b".repeat(MAX_TAG_LENGTH);
    expect(normalizeTag(exact)).toBe(exact);
  });
});

describe("标签关联 F1/U2 — mergeTagsUnion（并集去重，需求 11.1/11.3/11.4）", () => {
  it("两个不相交集合取并集，保持顺序", () => {
    expect(mergeTagsUnion(["a", "b"], ["c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  it("重复标签去重，每个标签恰好出现一次", () => {
    expect(mergeTagsUnion(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("incoming 已全部存在时结果与 existing 相同（不重复添加，需求 15.2）", () => {
    expect(mergeTagsUnion(["x", "y"], ["x"])).toEqual(["x", "y"]);
  });

  it("existing 为空时结果即 incoming 去重", () => {
    expect(mergeTagsUnion([], ["a", "a", "b"])).toEqual(["a", "b"]);
  });

  it("incoming 为空时结果即 existing 去重", () => {
    expect(mergeTagsUnion(["a", "a", "b"], [])).toEqual(["a", "b"]);
  });

  it("标签名逐字节比较，大小写/前后空白不同视为不同标签", () => {
    expect(mergeTagsUnion(["Tag"], ["tag"])).toEqual(["Tag", "tag"]);
    expect(mergeTagsUnion(["tag"], [" tag"])).toEqual(["tag", " tag"]);
  });

  it("保留敏感保留标签 __sensitive__ 的并集语义", () => {
    expect(mergeTagsUnion(["__sensitive__"], ["__sensitive__", "密码"])).toEqual([
      "__sensitive__",
      "密码",
    ]);
  });

  it("并集结果不含任一参与集合丢失的标签", () => {
    const existing = ["a", "b", "c"];
    const incoming = ["c", "d", "e"];
    const merged = mergeTagsUnion(existing, incoming);
    for (const tag of [...existing, ...incoming]) {
      expect(merged).toContain(tag);
    }
  });
});
