import { describe, expect, it } from "vitest";
import { deviceLabel } from "@/lib/device-label";

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const EDGE_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";

describe("deviceLabel", () => {
  it("names Chrome on macOS", () => expect(deviceLabel(CHROME_MAC)).toBe("Chrome on macOS"));
  it("prefers Edge over the Chrome token it also carries", () => expect(deviceLabel(EDGE_WIN)).toBe("Edge on Windows"));
  it("detects iOS before the 'like Mac OS X' token", () => expect(deviceLabel(SAFARI_IPHONE)).toBe("Safari on iOS"));
  it("names Firefox on Linux", () => expect(deviceLabel(FIREFOX_LINUX)).toBe("Firefox on Linux"));
  it("handles a missing user agent", () => expect(deviceLabel(null)).toBe("Unknown device"));
  it("falls back to a generic label for unknown clients", () => expect(deviceLabel("curl/8.7.1")).toBe("Browser"));
});
