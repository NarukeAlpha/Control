import { describe, expect, it } from "vitest";

import { parseJjLog, parseJjOperations, parseJjWorkingCopySummary, parseJjWorkspaces } from "./jjAdapter";

const fieldSeparator = "\x1f";
const recordSeparator = "\x1e";

describe("jjAdapter parsers", () => {
  it("parses templated log records with stable separators", () => {
    const output = [
      [
        "znkkpsqq",
        "abc123def456",
        "Add Area support",
        "Ada Lovelace",
        "ada@example.com",
        "2026-05-01T00:00:00Z"
      ].join(fieldSeparator),
      [
        "opqrstuv",
        "def456abc123",
        "Fix names with spaces",
        "Grace Hopper",
        "grace@example.com",
        "2026-05-02T00:00:00Z"
      ].join(fieldSeparator)
    ].join(recordSeparator);

    expect(parseJjLog(output)).toEqual([
      {
        id: "abc123def456",
        shortId: "abc123def456",
        changeId: "znkkpsqq",
        summary: "Add Area support",
        authorName: "Ada Lovelace",
        authorEmail: "ada@example.com",
        authoredAt: "2026-05-01T00:00:00Z"
      },
      {
        id: "def456abc123",
        shortId: "def456abc123",
        changeId: "opqrstuv",
        summary: "Fix names with spaces",
        authorName: "Grace Hopper",
        authorEmail: "grace@example.com",
        authoredAt: "2026-05-02T00:00:00Z"
      }
    ]);
  });

  it("parses templated operation log records", () => {
    const output = ["abcd1234", "snapshot working copy", "ada@example.com", "2026-05-01T00:00:00Z"].join(
      fieldSeparator
    );

    expect(parseJjOperations(output)).toEqual([
      {
        id: "abcd1234",
        shortId: "abcd1234",
        description: "snapshot working copy",
        user: "ada@example.com",
        time: "2026-05-01T00:00:00Z"
      }
    ]);
  });

  it("keeps working-copy change and commit IDs on the current workspace only", () => {
    const workingCopy = parseJjWorkingCopySummary(
      ["zzzzzzzz", "cafebabef00d", "Current", "", "", ""].join(fieldSeparator)
    );

    expect(
      parseJjWorkspaces({
        areaId: "local:area",
        repositoryId: "repo:jj",
        workspaceList: ["main: /work/main", "docs: /work/docs"].join("\n"),
        fallbackRootPath: "/work/main",
        currentWorkspaceRootPath: "/work/main",
        workingCopy,
        now: "2026-05-01T00:00:00.000Z",
        statusMessage: "Workspace is stale",
        sparseSummary: "src/**"
      })
    ).toEqual([
      expect.objectContaining({
        name: "main",
        rootPath: "/work/main",
        workingCopyChangeId: "zzzzzzzz",
        workingCopyCommitId: "cafebabef00d",
        isStale: true,
        sparseSummary: "src/**"
      }),
      expect.objectContaining({
        name: "docs",
        rootPath: "/work/docs",
        workingCopyChangeId: null,
        workingCopyCommitId: null,
        isStale: true,
        sparseSummary: "src/**"
      })
    ]);
  });
});
