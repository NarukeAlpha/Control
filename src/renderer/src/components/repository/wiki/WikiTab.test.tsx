import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepositoryDetail } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockRepository } from "../../../data/mocks/repository";
import { mockRepositoryWiki } from "../../../data/mocks/wiki";
import { WikiTab, type WikiTabProps } from "./WikiTab";

function installControlApi(githubOverrides: Partial<ControlApi["github"]> = {}) {
  const api = {
    github: {
      getRepositoryWiki: vi
        .fn()
        .mockImplementation((input) => mockRepositoryWiki(input.pagePath, input.limit)),
      ...githubOverrides
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderWikiTab({
  focusedPagePath = "Home.md",
  onMutate = vi.fn<WikiTabProps["onMutate"]>(),
  onOpenExternal = vi.fn<WikiTabProps["onOpenExternal"]>(),
  repository = mockRepository
}: {
  focusedPagePath?: string | null;
  onMutate?: WikiTabProps["onMutate"];
  onOpenExternal?: WikiTabProps["onOpenExternal"];
  repository?: RepositoryDetail;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <WikiTab
        githubReady={true}
        repository={repository}
        focusedPagePath={focusedPagePath}
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onMutate={onMutate}
        onOpenExternal={onOpenExternal}
        onSelectWikiPage={vi.fn()}
      />
    </QueryClientProvider>
  );

  return { ...result, onMutate, onOpenExternal };
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("WikiTab", () => {
  it("renders the focused wiki page and submits page edits", async () => {
    const api = installControlApi();
    const onMutate = vi.fn<WikiTabProps["onMutate"]>();
    renderWikiTab({ onMutate });

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

  it("keeps wiki browser layout bounded without GitHub fallback buttons", async () => {
    installControlApi();
    const { container, onOpenExternal } = renderWikiTab();

    expect(await screen.findByText("Mock wiki content for Home.")).toBeInTheDocument();
    expect(container.querySelector(".wiki-workspace")).not.toBeNull();
    expect(container.querySelector(".wiki-page-preview .markdown-body-lite")).not.toBeNull();

    expect(screen.queryByRole("button", { name: "Open wiki page on GitHub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open wiki on GitHub/i })).not.toBeInTheDocument();
    expect(onOpenExternal).not.toHaveBeenCalled();
  });

  it("renders disabled wiki state without loading pages", async () => {
    const api = installControlApi();
    const repository = {
      ...mockRepository,
      administration: {
        ...mockRepository.administration,
        features: {
          ...mockRepository.administration.features,
          wiki: false
        }
      }
    };
    renderWikiTab({ repository });

    expect(screen.getAllByText("Wiki is disabled for this repository.").length).toBeGreaterThan(0);
    expect(api.github.getRepositoryWiki).not.toHaveBeenCalled();
  });

  it("renders an empty wiki state without losing the editor panel", async () => {
    installControlApi({
      getRepositoryWiki: vi.fn().mockResolvedValue({
        pages: [],
        selectedPage: null,
        availability: { status: "available", message: null }
      })
    });
    const { container } = renderWikiTab({ focusedPagePath: null });

    expect(await screen.findByText("GitHub returned no wiki pages.")).toBeInTheDocument();
    expect(screen.getByText("Wiki pages will appear here when GitHub returns them.")).toBeInTheDocument();
    expect(container.querySelector(".wiki-side-panel")).not.toBeNull();
  });
});
