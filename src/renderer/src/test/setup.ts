import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const storageMock: Storage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(() => null),
  length: 0
};

Object.defineProperty(window, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true
});

