import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  EmptyState,
  ExternalLinkButton,
  LimitHitNotice,
  RepositoryChrome,
  RepositoryHero,
  RepositoryTabs,
  StateSegmentedControl,
  Surface
} from "./primitives";

describe("UI primitives", () => {
  it("renders a surface with variant and selected state contracts", () => {
    render(
      <Surface variant="row" selected data-testid="surface">
        Repository row
      </Surface>
    );

    expect(screen.getByTestId("surface")).toHaveClass("ui-surface", "ui-surface--row", "is-selected");
  });

  it("updates segmented state through explicit option values", async () => {
    const onChange = vi.fn();

    render(
      <StateSegmentedControl
        label="Issue state"
        value="open"
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" }
        ]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Closed" }));

    expect(onChange).toHaveBeenCalledWith("closed");
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses disabled reasons as button titles for external actions", () => {
    render(
      <ExternalLinkButton disabledReason="Repository URL is unavailable.">Open repository</ExternalLinkButton>
    );

    const button = screen.getByRole("button", { name: /open repository/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Repository URL is unavailable.");
  });

  it("omits limit notices until the list reaches the explicit limit", () => {
    const { rerender } = render(<LimitHitNotice shown={9} limit={10} />);

    expect(screen.queryByText(/showing the first/i)).not.toBeInTheDocument();

    rerender(<LimitHitNotice shown={10} limit={10} />);

    expect(screen.getByText("Showing the first 10 results.")).toBeInTheDocument();
  });

  it("renders repository chrome with hero, tabs, content, and rail slots", async () => {
    const onTabChange = vi.fn();

    render(
      <RepositoryChrome
        hero={
          <RepositoryHero
            model={{
              source: "github",
              displayName: "Control",
              nameWithOwner: "openai/control",
              statusChips: [{ id: "branch", label: "main", tone: "accent" }],
              actions: []
            }}
          />
        }
        tabs={
          <RepositoryTabs
            label="Repository sections"
            value="code"
            tabs={[
              { value: "code", label: "Code" },
              { value: "issues", label: "Issues", count: 4 }
            ]}
            onChange={onTabChange}
          />
        }
        rail={<EmptyState title="Rail" />}
      >
        <EmptyState title="Code content" />
      </RepositoryChrome>
    );

    expect(screen.getByRole("heading", { name: "Control" })).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Code content")).toBeInTheDocument();
    expect(screen.getByText("Rail")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /issues/i }));

    expect(onTabChange).toHaveBeenCalledWith("issues");
  });
});
