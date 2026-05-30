import { describe, it, expect } from "vitest";
import {
  SENSITIVE_TAG,
  computeFloatingTagSuggestions,
  canOpenFloatingTagInput,
  normalizeSubmittedTag,
} from "../../lib/floatingTagLogic";
import { mergeTagsUnion } from "../../../../shared/lib/clipboardCore";

/**
 * F1 快速打标签边界单元测试（任务 6.3 / 需求 15.2、15.5、15.7）。
 *
 * 被测：FloatingTagInput 组件与 useKeyboardNavigation 复用的纯逻辑
 *（src/features/tag/lib/floatingTagLogic.ts）。覆盖三类边界：
 * - 未选中任何条目时按 T 不显示、不操作（需求 15.5）。
 * - 内容为空或仅由空白字符组成时回车被忽略、不创建标签且保持打开（需求 15.7）。
 * - 已含同名标签的条目不重复添加（需求 15.2）。
 */

describe("未选中条目按 T 不显示浮动输入框（需求 15.5）", () => {
  it("非键盘导航模式下按 T 不打开（无选中）", () => {
    expect(canOpenFloatingTagInput(false, 0, 5)).toBe(false);
  });

  it("键盘模式但选中索引为 -1（无焦点条目）时不打开", () => {
    expect(canOpenFloatingTagInput(true, -1, 5)).toBe(false);
  });

  it("选中索引越界（≥列表长度）时不打开", () => {
    expect(canOpenFloatingTagInput(true, 5, 5)).toBe(false);
    expect(canOpenFloatingTagInput(true, 9, 5)).toBe(false);
  });

  it("空列表中按 T 不打开", () => {
    expect(canOpenFloatingTagInput(true, 0, 0)).toBe(false);
  });

  it("键盘模式且选中索引落在可见范围内时才打开（确有选中条目）", () => {
    expect(canOpenFloatingTagInput(true, 0, 5)).toBe(true);
    expect(canOpenFloatingTagInput(true, 4, 5)).toBe(true);
  });
});

describe("空/纯空白回车被忽略，不创建标签且保持打开（需求 15.7）", () => {
  it("空字符串提交返回 null（忽略，输入框保持打开）", () => {
    expect(normalizeSubmittedTag("")).toBeNull();
  });

  it("纯空格提交返回 null", () => {
    expect(normalizeSubmittedTag("   ")).toBeNull();
  });

  it("纯 Tab/换行提交返回 null", () => {
    expect(normalizeSubmittedTag("\t")).toBeNull();
    expect(normalizeSubmittedTag("\n")).toBeNull();
    expect(normalizeSubmittedTag(" \t \n ")).toBeNull();
  });

  it("非空文本提交返回去首尾空白后的有效标签", () => {
    expect(normalizeSubmittedTag("  工作  ")).toBe("工作");
    expect(normalizeSubmittedTag("urgent")).toBe("urgent");
  });

  it("超长标签截断到最大长度 50", () => {
    expect(normalizeSubmittedTag("a".repeat(80))).toHaveLength(50);
  });
});

describe("已含同名标签的条目不重复添加（需求 15.2）", () => {
  it("条目已含目标标签时，并集结果长度不变（视为无新增，跳过持久化）", () => {
    const current = ["工作", "重要"];
    const newTag = normalizeSubmittedTag(" 工作 ");
    expect(newTag).toBe("工作");
    const merged = mergeTagsUnion(current, [newTag as string]);
    // 长度不变 -> 调用方据此判定无需重复添加
    expect(merged.length).toBe(current.length);
    expect(merged).toEqual(["工作", "重要"]);
  });

  it("条目未含目标标签时，并集结果新增该标签", () => {
    const current = ["工作"];
    const merged = mergeTagsUnion(current, ["重要"]);
    expect(merged.length).toBe(current.length + 1);
    expect(merged).toEqual(["工作", "重要"]);
  });

  it("对多个选中条目分别去重：仅缺失的条目会新增标签", () => {
    const items = [
      { id: 1, tags: ["工作"] },
      { id: 2, tags: ["工作", "重要"] },
      { id: 3, tags: [] as string[] },
    ];
    const tag = normalizeSubmittedTag("重要") as string;
    const changedIds = items
      .filter((it) => mergeTagsUnion(it.tags, [tag]).length !== it.tags.length)
      .map((it) => it.id);
    // 条目 2 已含「重要」，不应被改动；条目 1、3 需新增
    expect(changedIds).toEqual([1, 3]);
  });
});

describe("预置标签建议始终包含保留标签 __sensitive__（需求 15.3）", () => {
  it("无任何已有标签时，建议首项为 __sensitive__", () => {
    const result = computeFloatingTagSuggestions([], [], "");
    expect(result[0]).toBe(SENSITIVE_TAG);
  });

  it("焦点条目已关联 __sensitive__ 时从建议中剔除，避免重复建议", () => {
    const result = computeFloatingTagSuggestions(["工作"], [SENSITIVE_TAG], "");
    expect(result).not.toContain(SENSITIVE_TAG);
    expect(result).toContain("工作");
  });

  it("按关键字过滤建议（忽略大小写、去首尾空白）", () => {
    const result = computeFloatingTagSuggestions(["Work", "Home"], [], "  wo ");
    expect(result).toEqual(["Work"]);
  });

  it("建议去重并保持首次出现顺序", () => {
    const result = computeFloatingTagSuggestions(["a", "a", "b"], [], "");
    expect(result).toEqual([SENSITIVE_TAG, "a", "b"]);
  });
});
