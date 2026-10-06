import { describe, it, expect } from "vitest";
import { categorizeError, executeProbe } from "../src/lib/probe/engine";

describe("Probe Engine", () => {
  describe("categorizeError", () => {
    it("should categorize timeout errors", () => {
      const abortErr = new Error("The operation was aborted");
      expect(categorizeError(abortErr).category).toBe("TIMEOUT");

      const timedOutErr = new Error("ETIMEDOUT connection error");
      expect(categorizeError(timedOutErr).category).toBe("TIMEOUT");
    });

    it("should categorize DNS resolution failures", () => {
      const dnsErr = Object.assign(new Error("getaddrinfo ENOTFOUND invalid.domain"), {
        code: "ENOTFOUND",
      });
      expect(categorizeError(dnsErr).category).toBe("DNS_ERROR");
    });

    it("should categorize SSL/TLS certificate errors", () => {
      const sslErr = new Error("certificate has expired");
      expect(categorizeError(sslErr).category).toBe("SSL_ERROR");
    });

    it("should categorize connection refused errors", () => {
      const connErr = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:80"), {
        code: "ECONNREFUSED",
      });
      expect(categorizeError(connErr).category).toBe("NETWORK_ERROR");
    });
  });

  describe("executeProbe SSRF interception", () => {
    it("should block SSRF attempts before making any network call", async () => {
      const result = await executeProbe("test-id", "http://127.0.0.1:8080/admin");

      expect(result.isHealthy).toBe(false);
      expect(result.errorCategory).toBe("SSRF_FORBIDDEN");
      expect(result.statusCode).toBeNull();
      expect(result.errorMessage).toContain("Blocked by SSRF protection");
    });
  });
});
