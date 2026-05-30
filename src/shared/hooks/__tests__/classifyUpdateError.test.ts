import { describe, it, expect } from "vitest";
import { classifyUpdateError } from "../useAutoUpdate";

/**
 * 更新检查错误分类单元测试（任务 27.2 / 需求 3.1、3.2、3.3）。
 *
 * classifyUpdateError 将更新检查抛出的原始英文异常归类为三类中文文案键：
 * - DNS 解析失败          -> update_error_dns（需求 3.1）
 * - TLS 握手 / 证书失败   -> update_error_tls（需求 3.2）
 * - 其他未知错误          -> update_error_generic（需求 3.3 兜底）
 *
 * 仅返回文案键、不返回原始英文异常文本，满足「不直接抛出原始英文异常」（需求 3.3）。
 */
describe("classifyUpdateError — 三类错误分类映射（需求 3.1/3.2/3.3）", () => {
  describe("DNS 解析问题 -> update_error_dns（需求 3.1）", () => {
    it("包含 dns 关键字归为 DNS 类", () => {
      expect(classifyUpdateError("DNS error while resolving host")).toBe(
        "update_error_dns"
      );
    });

    it("包含 resolve 关键字归为 DNS 类", () => {
      expect(classifyUpdateError("could not resolve host: github.com")).toBe(
        "update_error_dns"
      );
    });

    it("包含 failed to lookup 关键字归为 DNS 类", () => {
      expect(
        classifyUpdateError("failed to lookup address information")
      ).toBe("update_error_dns");
    });

    it("大小写不敏感（大写 DNS 文本同样归类）", () => {
      expect(classifyUpdateError("FATAL: DNS RESOLVE FAILED")).toBe(
        "update_error_dns"
      );
    });
  });

  describe("TLS / 证书握手问题 -> update_error_tls（需求 3.2）", () => {
    it("包含 tls 关键字归为 TLS 类", () => {
      expect(classifyUpdateError("TLS connection error")).toBe(
        "update_error_tls"
      );
    });

    it("包含 handshake 关键字归为 TLS 类", () => {
      expect(classifyUpdateError("ssl handshake failed")).toBe(
        "update_error_tls"
      );
    });

    it("包含 certificate 关键字归为 TLS 类", () => {
      expect(
        classifyUpdateError("certificate verification failed")
      ).toBe("update_error_tls");
    });

    it("大小写不敏感（大写 TLS 文本同样归类）", () => {
      expect(classifyUpdateError("CERTIFICATE EXPIRED")).toBe(
        "update_error_tls"
      );
    });
  });

  describe("其他错误 -> update_error_generic（需求 3.3 兜底）", () => {
    it("无关键字的通用错误归为通用类", () => {
      expect(classifyUpdateError("unexpected server response 500")).toBe(
        "update_error_generic"
      );
    });

    it("空字符串归为通用类", () => {
      expect(classifyUpdateError("")).toBe("update_error_generic");
    });

    it("超时类错误归为通用类", () => {
      expect(classifyUpdateError("request timed out")).toBe(
        "update_error_generic"
      );
    });
  });

  describe("DNS 优先于 TLS（关键字共存时按先匹配的 DNS 分类）", () => {
    it("同时含 dns 与 tls 时归为 DNS 类", () => {
      // 实现中 DNS 判定在前，故同时命中两类关键字时返回 DNS
      expect(classifyUpdateError("dns failure during tls handshake")).toBe(
        "update_error_dns"
      );
    });
  });

  describe("返回值始终为三类文案键之一，不暴露原始英文异常（需求 3.3）", () => {
    it("任何分类结果都属于受限的文案键集合", () => {
      const validKeys = [
        "update_error_dns",
        "update_error_tls",
        "update_error_generic",
      ];
      const samples = [
        "DNS resolve failed",
        "TLS handshake error",
        "random english exception text",
      ];
      for (const s of samples) {
        const key = classifyUpdateError(s);
        expect(validKeys).toContain(key);
        // 返回的是文案键而非原始英文异常本身
        expect(key).not.toBe(s);
      }
    });
  });
});
