import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, RepositoryDetail } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockProjects } from "../../../data/mocks/projects";
import { mockRepository } from "../../../data/mocks/repository";
import { ProjectsTab } from "./ProjectsTab";

const available = { status: "available", message: null } satisfies GitHubReadAvailability;

const repository: RepositoryDetail = {
  ...mockRepository,
  id: "repo-1",
  owner: "NarukeAlpha",
  name: "control",
  nameWithOwner: "NarukeAlpha/control",
  htmlUrl: "https://github.com/NarukeAlpha/control",
  defaultBranch: "main",
  administration: {
    ...mockRepository.administration,
    features: {
      ...mockRepository.administration.features,
      projects: true
    }
  }
};

function installControlApi() {
  const api = {
    github: {
      listProjectsWithStatus: vi.fn().mockResolvedValue({
        items: mockProjects,
        availability: available
      }),
      listIssuesWithStatus: vi.fn().mockResolvedValue({
        items: [],
        availability: available
      }),
      listPullRequestsWithStatus: vi.fn().mockResolvedValue({
        items: [],
        availability: available
      })
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderProjects(onMutate = vi.fn()): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectsTab
        repository={repository}
        githubReady={true}
        projectsLimit={20}
        focusedProjectId={null}
        onOpenExternal={vi.fn()}
        onSelectProject={vi.fn()}
        onExpandProjects={vi.fn()}
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onMutate={onMutate}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("ProjectsTab", () => {
  it("renders project detail and submits editable field changes", async () => {
    installControlApi();
    const onMutate = vi.fn();
    renderProjects(onMutate);

    expect(await screen.findByRole("heading", { name: "Compiler quality" })).toBeInTheDocument();
    expect(
      screen.getByText("Compiler correctness, crash triage, and high-priority diagnostics.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit field" })[0]);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "PFO_3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));

    expect(onMutate).toHaveBeenCalledWith("updateProjectV2Item", false, {
      projectId: "P_1",
      itemId: "PVTI_1",
      fieldId: "PF_1",
      value: { singleSelectOptionId: "PFO_3" }
    });
  });
});
