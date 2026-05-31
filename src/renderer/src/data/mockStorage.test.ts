import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearMockStorage,
  readMockArray,
  readMockStorageValue,
  writeMockArray,
  writeMockStorageValue
} from "./mockStorage";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  }
});

describe("mockStorage", () => {
  it("returns fallback values for absent keys, invalid JSON, and wrong shapes", () => {
    expect(readMockArray("missing", () => ["fallback"])).toEqual(["fallback"]);

    window.localStorage.setItem("invalid", "{");
    expect(readMockArray("invalid", () => ["fallback"])).toEqual(["fallback"]);

    window.localStorage.setItem("wrong", JSON.stringify({ items: [] }));
    expect(readMockArray("wrong", () => ["fallback"])).toEqual(["fallback"]);
  });

  it("round trips written values", () => {
    expect(writeMockArray("items", ["one", "two"])).toEqual({ ok: true });

    expect(readMockArray<string>("items")).toEqual(["one", "two"]);
  });

  it("clears storage through the mock adapter", () => {
    expect(writeMockArray("items", ["one", "two"])).toEqual({ ok: true });

    expect(clearMockStorage()).toEqual({ ok: true });

    expect(readMockArray<string>("items")).toEqual([]);
  });

  it("returns fresh fallback factory values", () => {
    const first = readMockArray<{ value: number }>("missing", () => [{ value: 1 }]);
    const second = readMockArray<{ value: number }>("missing", () => [{ value: 1 }]);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it("falls back when storage is unavailable or reads fail", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      }
    });

    expect(readMockArray("blocked", () => ["fallback"])).toEqual(["fallback"]);

    const storage = {
      getItem: vi.fn(() => {
        throw new Error("read failed");
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    } satisfies Storage;
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });

    expect(readMockArray("read-fails", () => ["fallback"])).toEqual(["fallback"]);
  });

  it("reports unavailable storage, write failures, and quota errors without throwing", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      }
    });

    expect(writeMockStorageValue("blocked", ["value"]).ok).toBe(false);
    expect(clearMockStorage().ok).toBe(false);

    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("write failed");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(() => {
        throw new Error("clear failed");
      }),
      key: vi.fn(),
      length: 0
    } satisfies Storage;
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });

    expect(writeMockStorageValue("write-fails", ["value"]).ok).toBe(false);
    expect(clearMockStorage().ok).toBe(false);

    storage.setItem.mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    const quotaResult = writeMockStorageValue("quota", ["value"]);
    expect(quotaResult.ok).toBe(false);
    expect(quotaResult.ok ? null : quotaResult.error).toBeInstanceOf(DOMException);
  });

  it("reads guarded object values", () => {
    writeMockStorageValue("settings", { enabled: true });

    expect(
      readMockStorageValue({
        key: "settings",
        fallback: () => ({ enabled: false }),
        isValue: (value): value is { enabled: boolean } =>
          Boolean(value) &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof (value as { enabled?: unknown }).enabled === "boolean"
      })
    ).toEqual({ enabled: true });
  });
});
