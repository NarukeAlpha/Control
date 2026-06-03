import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("resolves the confirm action from the primary command", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        prompt={{
          title: "Run operation",
          message: "Run fetch on this repository?",
          details: "git.fetch",
          confirmLabel: "Run operation",
          tone: "danger"
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByRole("dialog", { name: "Run operation" })).toBeInTheDocument();
    expect(screen.getByText("git.fetch")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Run operation" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels with the cancel button and Escape", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        prompt={{
          title: "Delete item",
          message: "Delete this item?",
          confirmLabel: "Delete",
          cancelLabel: "Keep"
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        prompt={{
          title: "Delete item",
          message: "Delete this item?"
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
