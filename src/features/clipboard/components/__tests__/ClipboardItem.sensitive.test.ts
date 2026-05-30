import { describe, it, expect } from "vitest";
import {
  SENSITIVE_TAG_NAMES,
  hasSensitiveTag,
  clipboardItemClassName,
  shouldShowSensitiveIcon,
} from "../../lib/sensitiveTag";
import { SENSITIVE_TAG } from "../../../tag/lib/floatingTagLogic";
import { mergeTagsUnion } from "../../../../shared/lib/clipboardCore";

/**
 * 敏感标记单元测试（任务 7.3 / 需求 17.1、17.2）。
 *
 * 被测：ClipboardItem 复用的敏感标记纯逻辑（src/features/clipboard/lib/sensitiveTag.ts）。
 * - 按 S 关联保留标签 __sensitive__ 的关联逻辑（去重不重复添加，需求 17.1）。
 * - 带 __sensitive__ 标签的条目在列表渲染时获得视觉强调（sensitive-item 类 + 标识图标，需求 17.2）。
 */

describe("按 S 关联保留标签 __sensitive__（需求 17.1）", () => {
  it("保留标签常量为 __sensitive__", () => {
    expect(SENSITIVE_TAG).toBe("__sensitive__");
  });

  it("未含敏感标签的条目按 S 后并集新增 __sensitive__", () => {
    const current = ["工作"];
    const merged = mergeTagsUnion(current, [SENSITIVE_TAG]);
    expect(merged).toContain(SENSITIVE_TAG);
    expect(merged.length).toBe(current.length + 1);
  });

  it("已含 __sensitive__ 的条目按 S 不重复添加（并集长度不变）", () => {
    const current = ["工作", SENSITIVE_TAG];
    const merged = mergeTagsUnion(current, [SENSITIVE_TAG]);
    expect(merged.length).toBe(current.length);
    // 恰好关联一次
    expect(merged.filter((t) => t === SENSITIVE_TAG)).toHaveLength(1);
  });
});

describe("带 __sensitive__ 标签的条目获得视觉强调（需求 17.2）", () => {
  it("hasSensitiveTag 识别 __sensitive__ 标签", () => {
    expect(hasSensitiveTag([SENSITIVE_TAG])).toBe(true);
    expect(hasSensitiveTag(["工作", SENSITIVE_TAG])).toBe(true);
  });

  it("hasSensitiveTag 兼容识别历史敏感标签", () => {
    expect(hasSensitiveTag(["sensitive"])).toBe(true);
    expect(hasSensitiveTag(["密码"])).toBe(true);
    expect(hasSensitiveTag(["password"])).toBe(true);
  });

  it("普通条目不被识别为敏感", () => {
    expect(hasSensitiveTag(["工作", "重要"])).toBe(false);
    expect(hasSensitiveTag([])).toBe(false);
    expect(hasSensitiveTag(undefined)).toBe(false);
  });

  it("敏感条目根容器 className 含强调类 sensitive-item", () => {
    const cls = clipboardItemClassName({
      isSelected: false,
      compactMode: false,
      isPinned: false,
      tags: [SENSITIVE_TAG],
    });
    expect(cls).toContain("history-item");
    expect(cls).toContain("sensitive-item");
  });

  it("非敏感条目 className 不含 sensitive-item", () => {
    const cls = clipboardItemClassName({
      isSelected: false,
      compactMode: false,
      isPinned: false,
      tags: ["工作"],
    });
    expect(cls).not.toContain("sensitive-item");
  });

  it("className 正确叠加其它状态类且不互相干扰", () => {
    const cls = clipboardItemClassName({
      isSelected: true,
      compactMode: true,
      isPinned: true,
      tags: [SENSITIVE_TAG],
      extraClassName: "custom-x",
    });
    expect(cls.split(/\s+/)).toEqual(
      expect.arrayContaining([
        "history-item",
        "selected",
        "compact",
        "pinned",
        "sensitive-item",
        "custom-x",
      ])
    );
  });

  it("敏感条目展示敏感标识图标", () => {
    expect(shouldShowSensitiveIcon([SENSITIVE_TAG])).toBe(true);
    expect(shouldShowSensitiveIcon(["工作"])).toBe(false);
  });

  it("敏感标签识别集合包含保留标签与历史兼容标签", () => {
    expect(SENSITIVE_TAG_NAMES).toContain(SENSITIVE_TAG);
    expect(SENSITIVE_TAG_NAMES).toContain("sensitive");
    expect(SENSITIVE_TAG_NAMES).toContain("密码");
  });
});
