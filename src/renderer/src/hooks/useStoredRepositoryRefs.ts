import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const repositoryRefsStorageKey = "control:repository-refs";

function browserStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRepositoryRefs(): Record<string, string | null> {
  const serialized = browserStorageOrNull()?.getItem(repositoryRefsStorageKey);
  if (!serialized) {
    return {};
  }

  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | null] =>
          typeof entry[0] === "string" && (typeof entry[1] === "string" || entry[1] === null)
      )
    );
  } catch {
    return {};
  }
}

function writeRepositoryRefs(refs: Record<string, string | null>): void {
  browserStorageOrNull()?.setItem(repositoryRefsStorageKey, JSON.stringify(refs));
}

export function useStoredRepositoryRefs(): [
  Record<string, string | null>,
  Dispatch<SetStateAction<Record<string, string | null>>>
] {
  const [repositoryRefs, setRepositoryRefs] = useState<Record<string, string | null>>(() =>
    readRepositoryRefs()
  );

  useEffect(() => {
    writeRepositoryRefs(repositoryRefs);
  }, [repositoryRefs]);

  return [repositoryRefs, setRepositoryRefs];
}
