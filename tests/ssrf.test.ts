import { describe, it, expect } from "vitest";
import { isPrivateIpv4, isPrivateIpv6, validateSafeUrl } from "../src/lib/probe/ssrf";

describe("SSRF Protection Engine", () => {
  describe("isPrivateIpv4", () => {
    it("should flag loopback addresses (127.0.0.0/8)", () => {
      expect(isPrivateIpv4("127.0.0.1")).toBe(true);
      expect(isPrivateIpv4("127.255.255.255")).toBe(true);
    });

    it("should flag RFC 1918 private subnets", () => {
      // 10.0.0.0/8
      expect(isPrivateIpv4("10.0.0.1")).toBe(true);
      expect(isPrivateIpv4("10.254.1.2")).toBe(true);

      // 172.16.0.0/12
      expect(isPrivateIpv4("172.16.0.1")).toBe(true);
      expect(isPrivateIpv4("172.31.255.254")).toBe(true);

      // 192.168.0.0/16
      expect(isPrivateIpv4("192.168.1.1")).toBe(true);
      expect(isPrivateIpv4("192.168.100.50")).toBe(true);
    });

    it("should flag cloud metadata and link-local (169.254.0.0/16)", () => {
      expect(isPrivateIpv4("169.254.169.254")).toBe(true);
      expect(isPrivateIpv4("169.254.1.1")).toBe(true);
    });

    it("should allow legitimate public IPv4 addresses", () => {
      expect(isPrivateIpv4("8.8.8.8")).toBe(false);
      expect(isPrivateIpv4("1.1.1.1")).toBe(false);
      expect(isPrivateIpv4("142.250.190.46")).toBe(false);
    });
  });

  describe("isPrivateIpv6", () => {
    it("should flag loopback ::1 and unspecified ::", () => {
      expect(isPrivateIpv6("::1")).toBe(true);
      expect(isPrivateIpv6("::")).toBe(true);
    });

    it("should flag unique local addresses (fc00::/7)", () => {
      expect(isPrivateIpv6("fc00::1")).toBe(true);
      expect(isPrivateIpv6("fd12:3456:789a::1")).toBe(true);
    });

    it("should flag link-local addresses (fe80::/10)", () => {
      expect(isPrivateIpv6("fe80::1")).toBe(true);
    });

    it("should flag IPv4-mapped loopback", () => {
      expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    });
  });

  describe("validateSafeUrl", () => {
    it("should reject non-http/https protocols", async () => {
      const fileRes = await validateSafeUrl("file:///etc/passwd");
      expect(fileRes.safe).toBe(false);

      const ftpRes = await validateSafeUrl("ftp://example.com/file");
      expect(ftpRes.safe).toBe(false);
    });

    it("should reject localhost and internal hostnames", async () => {
      const localhostRes = await validateSafeUrl("http://localhost:3000");
      expect(localhostRes.safe).toBe(false);

      const metadataRes = await validateSafeUrl("http://metadata.google.internal");
      expect(metadataRes.safe).toBe(false);
    });

    it("should reject direct private IP targets", async () => {
      const ipRes = await validateSafeUrl("http://127.0.0.1/admin");
      expect(ipRes.safe).toBe(false);

      const awsRes = await validateSafeUrl("http://169.254.169.254/latest/meta-data/");
      expect(awsRes.safe).toBe(false);
    });

    it("should allow safe public endpoints", async () => {
      const publicRes = await validateSafeUrl("https://1.1.1.1/cdn-cgi/trace");
      expect(publicRes.safe).toBe(true);
    });
  });
});
