import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ControlApi } from "@shared/ipc";
import { mockRepository } from "../../../data/mocks/repository";
import { mockRepositoryWiki } from "../../../data/mocks/wiki";
import { WikiTab } from "./WikiTab";

function installControlApi() {
  const api = {
    github: {
      getRepositoryWiki: vi
        .fn()
        .mockImplementation((input) => mockRepositoryWiki(input.pagePath, input.limit))
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderWikiTab(onMutate = vi.fn()): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <WikiTab
        githubReady={true}
        repository={mockRepository}
        focusedPagePath="Home.md"
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onMutate={onMutate}
        onOpenExternal={vi.fn()}
        onSelectWikiPage={vi.fn()}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("WikiTab", () => {
  it("renders the focused wiki page and submits page edits", async () => {
    const api = installControlApi();
    const onMutate = vi.fn();
    renderWikiTab(onMutate);

    expect(await screen.findByText("Mock wiki content for Home.")).toBeInTheDocument();
    expect(api.github.getRepositoryWiki).toHaveBeenCalledWith({
      owner: "apple",
      repo: "swift",
      pagePath: "Home.md",
      limit: 50,
      cacheOnly: false
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit selected" }));
    fireEvent.change(screen.getByPlaceholderText("Write the wiki page markdown."), {
      target: { value: "# Home\n\nUpdated repository wiki content." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save page" }));

    expect(onMutate).toHaveBeenCalledWith("editWikiPage", false, {
      pagePath: "Home.md",
      content: "# Home\n\nUpdated repository wiki content."
    });
  });
});
