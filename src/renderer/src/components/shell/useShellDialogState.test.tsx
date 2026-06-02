import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useShellDialogState } from "./useShellDialogState";

describe("useShellDialogState", () => {
  it("resolves confirmation promises on accept and cancel", async () => {
    const { result } = renderHook(() => useShellDialogState());

    let accepted: Promise<boolean>;
    act(() => {
      accepted = result.current.requestConfirmation({
        title: "Run operation",
        message: "Run the prepared operation?"
      });
    });

    expect(result.current.confirmation?.title).toBe("Run operation");

    act(() => result.current.acceptConfirmation());
    await expect(accepted!).resolves.toBe(true);
    expect(result.current.confirmation).toBeNull();

    let canceled: Promise<boolean>;
    act(() => {
      canceled = result.current.requestConfirmation({
        title: "Cancel operation",
        message: "Cancel this operation?"
      });
    });

    act(() => result.current.cancelConfirmation());
    await expect(canceled!).resolves.toBe(false);
    expect(result.current.confirmation).toBeNull();
  });

  it("cancels an existing confirmation when a newer prompt replaces it", async () => {
    const { result } = renderHook(() => useShellDialogState());

    let first: Promise<boolean>;
    let second: Promise<boolean>;
    act(() => {
      first = result.current.requestConfirmation({ title: "First", message: "First prompt" });
      second = result.current.requestConfirmation({ title: "Second", message: "Second prompt" });
    });

    await expect(first!).resolves.toBe(false);
    expect(result.current.confirmation?.title).toBe("Second");

    act(() => result.current.acceptConfirmation());
    await expect(second!).resolves.toBe(true);
  });
});
