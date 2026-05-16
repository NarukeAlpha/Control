import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

const storage = new Map<string, string>();
const storageMock: Storage = {
  getItem: vi.fn((key) => storage.get(String(key)) ?? null),
  setItem: vi.fn((key, value) => {
    storage.set(String(key), String(value));
  }),
  removeItem: vi.fn((key) => {
    storage.delete(String(key));
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
  key: vi.fn((index) => Array.from(storage.keys())[index] ?? null),
  get length() {
    return storage.size;
  }
};

Object.defineProperty(window, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true
});

afterEach(() => {
  storage.clear();
  vi.mocked(storageMock.getItem).mockClear();
  vi.mocked(storageMock.setItem).mockClear();
  vi.mocked(storageMock.removeItem).mockClear();
  vi.mocked(storageMock.clear).mockClear();
  vi.mocked(storageMock.key).mockClear();
});
