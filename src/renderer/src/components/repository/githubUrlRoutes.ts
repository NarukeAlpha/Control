import { normalizeCodeLineNumber } from "../code-browser/codeBrowserUi";

export function repositoryNameWithOwnerFromGitHubUrl(url: string): string | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\//);
  return match?.[1] ?? null;
}

interface GitHubBlobRoute {
  nameWithOwner: string;
  ref: string;
  path: string;
  line: number | null;
}

interface GitHubCodeUrlRoute extends GitHubBlobRoute {
  entryType: "file" | "dir";
}

const githubNonRepositoryPathRoots = new Set([
  "about",
  "apps",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "login",
  "marketplace",
  "mobile",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "readme",
  "search",
  "security",
  "settings",
  "signup",
  "sponsors",
  "team",
  "topics",
  "trending"
]);

export function parseGitHubRepositoryUrl(
  url: string
): { nameWithOwner: string; segments: string[]; hash: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments.length < 2) {
      return null;
    }
    if (githubNonRepositoryPathRoots.has(segments[0])) {
      return null;
    }

    return {
      nameWithOwner: `${segments[0]}/${segments[1]}`,
      segments,
      hash: parsed.hash
    };
  } catch {
    return null;
  }
}

export function parseGitHubBlobUrl(
  url: string | null | undefined,
  expectedPath?: string | null
): GitHubBlobRoute | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments.length < 5 || segments[2] !== "blob") {
      return null;
    }
    const blobSegments = segments.slice(3);
    const expectedPathSegments = expectedPath?.split("/").filter(Boolean) ?? [];
    const matchingExpectedPath =
      expectedPathSegments.length > 0 &&
      blobSegments.length > expectedPathSegments.length &&
      expectedPathSegments.every(
        (segment, index) =>
          segment === blobSegments[blobSegments.length - expectedPathSegments.length + index]
      );
    const refSegments = matchingExpectedPath
      ? blobSegments.slice(0, blobSegments.length - expectedPathSegments.length)
      : blobSegments.slice(0, 1);
    const pathSegments = matchingExpectedPath
      ? blobSegments.slice(blobSegments.length - expectedPathSegments.length)
      : blobSegments.slice(1);

    return {
      nameWithOwner: `${segments[0]}/${segments[1]}`,
      ref: refSegments.join("/"),
      path: pathSegments.join("/"),
      line: normalizeGitHubBlobLine(parsed.hash)
    };
  } catch {
    return null;
  }
}

export function parseGitHubCodeUrl(
  url: string,
  refs: string[],
  fallbackRef: string | null | undefined
): GitHubCodeUrlRoute | null {
  const parsed = parseGitHubRepositoryUrl(url);
  if (!parsed || parsed.segments.length < 4) {
    return null;
  }

  const [, , kind, ...codeSegments] = parsed.segments;
  if ((kind !== "blob" && kind !== "tree") || codeSegments.length === 0) {
    return null;
  }

  const normalizedRefs = refs
    .map(normalizeGitHubCodeRef)
    .filter((ref): ref is string => Boolean(ref))
    .sort((left, right) => right.split("/").length - left.split("/").length || right.length - left.length);
  const matchedRef = normalizedRefs.find((ref) => {
    const refSegments = ref.split("/").filter(Boolean);
    if (refSegments.length === 0 || codeSegments.length < refSegments.length) {
      return false;
    }

    for (let index = 0; index < refSegments.length; index += 1) {
      if (codeSegments[index] !== refSegments[index]) {
        return false;
      }
    }

    return true;
  });
  const refSegmentCount = matchedRef?.split("/").filter(Boolean).length ?? 1;
  const ref = matchedRef ?? normalizeGitHubCodeRef(fallbackRef) ?? codeSegments[0] ?? null;
  if (!ref) {
    return null;
  }

  return {
    nameWithOwner: parsed.nameWithOwner,
    ref,
    path: codeSegments.slice(refSegmentCount).join("/"),
    entryType: kind === "blob" ? "file" : "dir",
    line: kind === "blob" ? normalizeGitHubBlobLine(parsed.hash) : null
  };
}

function normalizeGitHubBlobLine(hash: string): number | null {
  const match = hash.match(/^#L(\d+)/);
  return normalizeCodeLineNumber(match ? Number(match[1]) : null);
}

function normalizeGitHubCodeRef(ref: string | null | undefined): string | null {
  const trimmedRef = ref?.trim();
  if (!trimmedRef) {
    return null;
  }

  return trimmedRef.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "");
}
