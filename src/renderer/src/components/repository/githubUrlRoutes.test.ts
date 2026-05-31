import { describe, expect, it } from "vitest";

import {
  parseGitHubBlobUrl,
  parseGitHubCodeUrl,
  repositoryNameWithOwnerFromGitHubUrl
} from "./githubUrlRoutes";

describe("githubUrlRoutes", () => {
  it("extracts repository names from GitHub item URLs", () => {
    expect(repositoryNameWithOwnerFromGitHubUrl("https://github.com/openai/control/issues/12")).toBe(
      "openai/control"
    );
    expect(repositoryNameWithOwnerFromGitHubUrl("https://example.com/openai/control/issues/12")).toBeNull();
  });

  it("parses blob URLs with refs that contain slashes when the expected path is known", () => {
    expect(
      parseGitHubBlobUrl(
        "https://github.com/openai/control/blob/feature/cleanup/src/renderer/src/App.tsx#L42",
        "src/renderer/src/App.tsx"
      )
    ).toEqual({
      nameWithOwner: "openai/control",
      ref: "feature/cleanup",
      path: "src/renderer/src/App.tsx",
      line: 42
    });
  });

  it("matches code URLs against known refs before falling back to the first path segment", () => {
    expect(
      parseGitHubCodeUrl(
        "https://github.com/openai/control/tree/feature/cleanup/docs",
        ["main", "feature/cleanup"],
        "main"
      )
    ).toEqual({
      nameWithOwner: "openai/control",
      ref: "feature/cleanup",
      path: "docs",
      entryType: "dir",
      line: null
    });
  });
});
