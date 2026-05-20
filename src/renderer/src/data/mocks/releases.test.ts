import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockReleases, mutateMockReleases, readMockReleases } from "./releases";

describe("release mocks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates releases through the persisted release domain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T14:00:00.000Z"));

    mutateMockReleases({
      action: "createRelease",
      owner: "apple",
      repo: "swift",
      tag_name: "swift-6.0",
      target_commitish: "release/6.0",
      name: "Swift 6.0",
      body: "Release notes",
      draft: false,
      prerelease: false
    });

    const createdRelease = readMockReleases()[0];
    expect(createdRelease).toMatchObject({
      name: "Swift 6.0",
      tagName: "swift-6.0",
      targetCommitish: "release/6.0",
      body: "Release notes",
      isDraft: false,
      isPrerelease: false,
      publishedAt: "2026-05-20T14:00:00.000Z",
      htmlUrl: "https://github.com/apple/swift/releases/tag/swift-6.0"
    });
  });

  it("edits and deletes persisted releases", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T14:30:00.000Z"));
    const release = mockReleases[0];

    mutateMockReleases({
      action: "editRelease",
      owner: "apple",
      repo: "swift",
      releaseId: release.id,
      tag_name: "swift-5.10.1",
      target_commitish: "main",
      name: "Swift 5.10.1",
      body: "Updated release notes",
      draft: true,
      prerelease: true
    });

    const editedRelease = readMockReleases().find((item) => item.id === release.id);
    expect(editedRelease).toMatchObject({
      tagName: "swift-5.10.1",
      name: "Swift 5.10.1",
      body: "Updated release notes",
      isDraft: true,
      isPrerelease: true,
      publishedAt: null
    });

    mutateMockReleases({
      action: "deleteRelease",
      owner: "apple",
      repo: "swift",
      releaseId: release.id
    });

    expect(readMockReleases().some((item) => item.id === release.id)).toBe(false);
  });
});
