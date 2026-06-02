import type {
  GitHubMutationInput,
  ReleaseDetailInput,
  ReleaseDetailResult,
  ReleaseSummary
} from "@shared/github";

import { readMockArray, writeMockArray } from "../mockStorage";
import {
  mockPayload,
  mockPayloadBoolean,
  mockPayloadString,
  mockPrimaryRepository,
  mockReleasesKey
} from "./shared";

export const mockReleases: ReleaseSummary[] = [
  {
    id: 1,
    name: "Swift 5.10.0",
    tagName: "swift-5.10.0",
    targetCommitish: "main",
    body: "Release notes include compiler fixes, concurrency runtime updates, and package manager polish.",
    isDraft: false,
    isPrerelease: false,
    publishedAt: new Date(Date.now() - 172_800_000).toISOString(),
    htmlUrl: `${mockPrimaryRepository.htmlUrl}/releases/tag/swift-5.10.0`,
    assets: [
      {
        id: 101,
        name: "swift-5.10.0-macos.pkg",
        label: "macOS installer",
        state: "uploaded",
        contentType: "application/octet-stream",
        sizeInBytes: 241_172_480,
        downloadCount: 1842,
        browserDownloadUrl: `${mockPrimaryRepository.htmlUrl}/releases/download/swift-5.10.0/swift.pkg`,
        createdAt: new Date(Date.now() - 172_800_000).toISOString(),
        updatedAt: new Date(Date.now() - 172_800_000).toISOString()
      }
    ]
  }
];

export function readMockReleases(): ReleaseSummary[] {
  return readMockArray(mockReleasesKey, () => mockReleases);
}

function writeMockReleases(items: ReleaseSummary[]): void {
  writeMockArray(mockReleasesKey, items);
}

export function mockReleaseDetail(input: ReleaseDetailInput): ReleaseDetailResult {
  const item =
    typeof input.releaseId === "number"
      ? readMockReleases().find((release) => release.id === input.releaseId)
      : readMockReleases().find((release) => release.tagName === input.releaseTagName);

  return {
    item: item ?? null,
    availability: item
      ? { status: "available", message: null }
      : { status: "error", message: "Release not found in mock data." }
  };
}

export function mutateMockReleases(input: GitHubMutationInput): void {
  const payload = mockPayload(input);
  if (input.action === "createRelease") {
    const tagName = mockPayloadString(payload, "tag_name")?.trim();
    if (!tagName) {
      return;
    }
    const draft = mockPayloadBoolean(payload, "draft");
    const prerelease = mockPayloadBoolean(payload, "prerelease");
    const createdRelease: ReleaseSummary = {
      id: Date.now(),
      name: mockPayloadString(payload, "name"),
      tagName,
      targetCommitish: mockPayloadString(payload, "target_commitish") ?? "main",
      body: mockPayloadString(payload, "body"),
      isDraft: draft,
      isPrerelease: prerelease,
      publishedAt: draft ? null : new Date().toISOString(),
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/releases/tag/${encodeURIComponent(tagName)}`,
      assets: []
    };
    writeMockReleases([createdRelease, ...readMockReleases()]);
    return;
  }

  if (input.action === "editRelease") {
    const releaseId = typeof payload?.releaseId === "number" ? payload.releaseId : null;
    if (releaseId === null) {
      return;
    }
    const draft = mockPayloadBoolean(payload, "draft");
    const nextReleases = readMockReleases().map((release) =>
      release.id === releaseId
        ? {
            ...release,
            name: mockPayloadString(payload, "name"),
            tagName: mockPayloadString(payload, "tag_name") ?? release.tagName,
            targetCommitish: mockPayloadString(payload, "target_commitish") ?? release.targetCommitish,
            body: mockPayloadString(payload, "body") ?? release.body,
            isDraft: draft,
            isPrerelease: mockPayloadBoolean(payload, "prerelease"),
            publishedAt: draft ? null : (release.publishedAt ?? new Date().toISOString())
          }
        : release
    );
    writeMockReleases(nextReleases);
    return;
  }

  if (input.action === "deleteRelease") {
    const releaseId = typeof payload?.releaseId === "number" ? payload.releaseId : null;
    if (releaseId === null) {
      return;
    }
    writeMockReleases(readMockReleases().filter((release) => release.id !== releaseId));
  }
}
