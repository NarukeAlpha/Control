import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { clearMockStorage } from "../mockStorage";

interface MockDomainTestCleanupOptions {
  beforeEach?: () => void;
  afterEach?: () => void;
  resetQueryClients?: () => void;
  resetModuleState?: () => void;
}

export function installMockDomainTestCleanup(options: MockDomainTestCleanupOptions = {}): void {
  beforeEach(() => {
    cleanup();
    clearMockStorage();
    vi.clearAllMocks();
    options.resetQueryClients?.();
    options.resetModuleState?.();
    options.beforeEach?.();
  });

  afterEach(() => {
    options.afterEach?.();
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearMockStorage();
    options.resetQueryClients?.();
    options.resetModuleState?.();
  });
}
