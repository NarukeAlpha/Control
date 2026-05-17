import { describe, expect, it } from "vitest";

import {
  parseDefaultBranch,
  parseGitBranches,
  parseGitCommits,
  parseGitRemotes,
  parseGitStatus
} from "./localGit";

describe("localGit parsers", () => {
  it("normalizes origin HEAD refs to branch names", () => {
    expect(parseDefaultBranch("origin/main")).toBe("main");
    expect(parseDefaultBranch("feature/local-area")).toBe("feature/local-area");
    expect(parseDefaultBranch("")).toBeNull();
  });

  it("parses remotes and attaches GitHub connection metadata", () => {
    expect(
      parseGitRemotes(
        [
          "origin\thttps://github.com/NarukeAlpha/Control.git (fetch)",
          "origin\tgit@github.com:NarukeAlpha/Control.git (push)",
          "upstream\thttps://example.com/upstream/control.git (fetch)"
        ].join("\n"),
        "github:default"
      )
    ).toEqual([
      expect.objectContaining({
        name: "origin",
        fetchUrl: "https://github.com/NarukeAlpha/Control.git",
        pushUrl: "git@github.com:NarukeAlpha/Control.git",
        github: expect.objectContaining({
          owner: "NarukeAlpha",
          repo: "Control",
          matchedGitHubAreaId: "github:default"
        })
      }),
      expect.objectContaining({
        name: "upstream",
        fetchUrl: "https://example.com/upstream/control.git",
        github: null
      })
    ]);
  });

  it("parses branch, status, and commit output", () => {
    expect(
      parseGitBranches("main\u0000*\u0000origin/main\u0000abc123\nfeature\u0000 \u0000\u0000def456")
    ).toEqual([
      { name: "main", current: true, upstream: "origin/main", commit: "abc123" },
      { name: "feature", current: false, upstream: null, commit: "def456" }
    ]);

    expect(
      parseGitStatus("## main...origin/main [ahead 1, behind 2]\n M src/App.tsx\n?? docs/new.md")
    ).toEqual({
      clean: false,
      dirtyCount: 1,
      untrackedCount: 1,
      conflictedCount: 0,
      ahead: 1,
      behind: 2,
      entries: [
        { indexStatus: null, workingTreeStatus: "M", path: "src/App.tsx" },
        { indexStatus: "?", workingTreeStatus: "?", path: "docs/new.md" }
      ]
    });

    expect(
      parseGitCommits(
        "abc123\u0000abc1234\u0000Ada\u0000ada@example.com\u00002026-05-01T00:00:00Z\u0000Initial"
      )
    ).toEqual([
      {
        id: "abc123",
        shortId: "abc1234",
        changeId: null,
        summary: "Initial",
        authorName: "Ada",
        authorEmail: "ada@example.com",
        authoredAt: "2026-05-01T00:00:00Z"
      }
    ]);
  });
});
