import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RepoFileContent } from "@shared/github";

import { mockFileContent } from "../../data/mocks/contents";
import { mockRepositoryDetail } from "../../data/mocks/repository";
import { CodeBrowserPage } from "./CodeBrowserPage";

const repository = mockRepositoryDetail({ owner: "apple", repo: "swift" });

describe("CodeBrowserPage file states", () => {
  it("renders provider image state through the raw download URL", () => {
    renderCodeBrowser({
      ...mockFileContent({ path: "assets/logo.png", ref: "main" }),
      kind: "image",
      content: null,
      encoding: null,
      downloadUrl: "https://raw.githubusercontent.com/apple/swift/main/assets/logo.png"
    });

    expect(screen.getByRole("img", { name: "logo.png" })).toHaveAttribute(
      "src",
      "https://raw.githubusercontent.com/apple/swift/main/assets/logo.png"
    );
    expect(screen.queryByRole("button", { name: /Blame/i })).not.toBeInTheDocument();
  });

  it("shows binary and large-file fallbacks without enabling raw copy", () => {
    const { rerender } = renderCodeBrowser({
      ...mockFileContent({ path: "dist/app.zip", ref: "main" }),
      kind: "binary",
      content: null,
      encoding: null,
      message: "Binary files are not previewed as text."
    });

    expect(screen.getByText("Binary preview unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy raw/i })).toBeDisabled();

    rerender(
      codeBrowserElement({
        ...mockFileContent({ path: "src/huge.ts", ref: "main" }),
        kind: "too_large",
        content: null,
        encoding: null,
        size: 3 * 1024 * 1024,
        message: "File preview was skipped because the file exceeds the preview size limit."
      })
    );

    expect(screen.getByText("Large file preview skipped")).toBeInTheDocument();
    expect(document.querySelector(".code-source-line")).toBeNull();
  });
});

function renderCodeBrowser(fileContent: RepoFileContent) {
  return render(codeBrowserElement(fileContent));
}

function codeBrowserElement(fileContent: RepoFileContent) {
  return (
    <CodeBrowserPage
      availabilityMessage={null}
      branches={[]}
      commits={[]}
      commitsAvailability={null}
      commitsError={null}
      commitsLimit={12}
      commitsLoading={false}
      contents={[]}
      contentsAvailability={null}
      contentsError={null}
      contentsLoading={false}
      error={null}
      fileAvailabilityMessage={null}
      fileContent={fileContent}
      fileError={null}
      fileLoading={false}
      githubReady
      refsAvailabilityMessage={null}
      refsError={null}
      refsLoading={false}
      repository={repository}
      route={{
        kind: "codeBrowser",
        nameWithOwner: "apple/swift",
        path: fileContent.path,
        entryType: "file",
        ref: "main",
        line: null
      }}
      tags={[]}
      onBackToRepository={vi.fn()}
      onExpandCommits={vi.fn()}
      onOpenCodeBrowser={vi.fn()}
      onOpenCommit={vi.fn()}
      onOpenExternal={vi.fn()}
      onRefresh={vi.fn()}
      onSelectRef={vi.fn()}
    />
  );
}
