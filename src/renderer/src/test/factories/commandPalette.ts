import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function openCommandPalette(): Promise<HTMLElement> {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  return screen.findByRole("dialog", { name: "Command palette" });
}

export async function clickCommandPaletteOption(name: RegExp): Promise<void> {
  const palette = await screen.findByRole("dialog", { name: "Command palette" });
  await userEvent.click(within(palette).getByRole("option", { name }));
}

export async function openAddRepositoryDialog(): Promise<HTMLElement> {
  const addRepositoryButtons = await screen.findAllByRole("button", { name: "Add repository" });
  await userEvent.click(addRepositoryButtons[0]);
  return screen.findByRole("dialog", { name: "Add repository" });
}
